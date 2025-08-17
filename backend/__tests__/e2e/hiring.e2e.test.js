import request from 'supertest';
import app from '../../src/app.js';
import queryWithRetry, { pool } from '../../src/services/db.js';
import { client, emptyBucket } from '../../src/services/s3.js';
import path from 'path';
import fs from 'fs';

// Clean up the database and S3 bucket before and after tests
beforeAll(async () => {
  await queryWithRetry('TRUNCATE TABLE applications RESTART IDENTITY CASCADE');
  await queryWithRetry('TRUNCATE TABLE jobs RESTART IDENTITY CASCADE');
  await queryWithRetry('TRUNCATE TABLE resumes RESTART IDENTITY CASCADE');
  await queryWithRetry('TRUNCATE TABLE refresh_tokens RESTART IDENTITY CASCADE');
  await emptyBucket();
});

afterAll(async () => {
  await pool.end();
  client.destroy();
});

it('should complete the full lifecycle of a job application', async () => {
  // 1. Log in as admin
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'password' });
  expect(loginResponse.status).toBe(200);
  let adminAccess = loginResponse.body.accessToken;
  const adminRefresh = loginResponse.body.refreshToken;

  // 2. ADMIN: Create a job
  const jobData = {
    title: 'Software Engineer',
    description: 'A great job',
    adminId: 1,
  };
  const jobResponse = await request(app)
    .post('/api/jobs')
    .send(jobData)
    .set('Authorization', `Bearer ${adminAccess}`);
  expect(jobResponse.status).toBe(201);
  const jobId = jobResponse.body.jobId;

  // 3. USER: View all jobs
  const jobsResponse = await request(app).get('/api/jobs');
  expect(jobsResponse.status).toBe(200);
  const job = jobsResponse.body.jobs.find((j) => j.id === jobId);
  expect(job).toBeDefined();

  // 4. USER: View job by id
  const jobViewResponse = await request(app).get(`/api/jobs/${jobId}`);
  expect(jobViewResponse.status).toBe(200);
  expect(jobViewResponse.body.job.id).toBe(jobId);

  // 5. USER: Upload a resume
  const resumePath = path.join(__dirname, '..', 'fixtures', 'resume.pdf');
  const resumeResponse = await request(app).post('/api/resumes').attach('resume', resumePath);
  expect(resumeResponse.status).toBe(201);
  const resumeId = resumeResponse.body.resumeId;

  // 6. USER: Submit an application
  const applicationData = {
    applicantName: 'Test User',
    applicantEmail: 'test@example.com',
    resumeId: resumeId,
  };
  const applicationResponse = await request(app)
    .post(`/api/jobs/${jobId}/applications`)
    .send(applicationData);
  expect(applicationResponse.status).toBe(201);
  const applicationId = applicationResponse.body.applicationId;

  // 7. ADMIN: Refresh token
  const refreshResponse = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: adminRefresh });
  expect(refreshResponse.status).toBe(200);
  adminAccess = refreshResponse.body.accessToken;

  // 8. ADMIN: View applications for the job
  const applicationsResponse = await request(app)
    .get(`/api/jobs/${jobId}/applications`)
    .set('Authorization', `Bearer ${adminAccess}`);
  expect(applicationsResponse.status).toBe(200);
  expect(applicationsResponse.body.applications.length).toBe(1);
  expect(applicationsResponse.body.applications[0].id).toBe(applicationId);

  // 9. ADMIN: View the user's application
  const applicationViewResponse = await request(app)
    .get(`/api/applications/${applicationId}`)
    .set('Authorization', `Bearer ${adminAccess}`);
  expect(applicationViewResponse.status).toBe(200);
  expect(applicationViewResponse.body.application.id).toBe(applicationId);

  // 10. ADMIN: View the user's resume
  const resumeViewResponse = await request(app)
    .get(`/api/resumes/${resumeId}`)
    .set('Authorization', `Bearer ${adminAccess}`);
  expect(resumeViewResponse.status).toBe(200);
  expect(resumeViewResponse.headers['content-type']).toBe('application/pdf');
  const fileBuffer = fs.readFileSync(resumePath);
  expect(resumeViewResponse.body).toEqual(fileBuffer);

  // 11. ADMIN: Delete the resume
  const deleteResumeResponse = await request(app)
    .delete(`/api/resumes/${resumeId}`)
    .set('Authorization', `Bearer ${adminAccess}`);
  expect(deleteResumeResponse.status).toBe(204);

  // 12. ADMIN: Delete the application
  const deleteApplicationResponse = await request(app)
    .delete(`/api/applications/${applicationId}`)
    .set('Authorization', `Bearer ${adminAccess}`);
  expect(deleteApplicationResponse.status).toBe(204);

  // 13. ADMIN: Delete the job
  const deleteJobResponse = await request(app)
    .delete(`/api/jobs/${jobId}`)
    .set('Authorization', `Bearer ${adminAccess}`);
  expect(deleteJobResponse.status).toBe(204);

  // 14. ADMIN: Verify everything is deleted
  const deletedJobResponse = await request(app)
    .get(`/api/jobs/${jobId}`)
    .set('Authorization', `Bearer ${adminAccess}`);
  expect(deletedJobResponse.status).toBe(404);
  const deletedApplicationResponse = await request(app)
    .get(`/api/applications/${applicationId}`)
    .set('Authorization', `Bearer ${adminAccess}`);
  expect(deletedApplicationResponse.status).toBe(404);
  const deletedResumeResponse = await request(app)
    .get(`/api/resumes/${resumeId}`)
    .set('Authorization', `Bearer ${adminAccess}`);
  expect(deletedResumeResponse.status).toBe(404);

  // 15. Log out
  const logoutResponse = await request(app).post('/api/auth/logout').send({
    refreshToken: adminRefresh,
  });
  expect(logoutResponse.status).toBe(204);
});
