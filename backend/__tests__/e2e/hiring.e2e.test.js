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
  await emptyBucket();
});

afterAll(async () => {
  await pool.end();
  client.destroy();
});

it('should complete the full lifecycle of a job application', async () => {
  // 1. Create a job
  const jobData = {
    title: 'Software Engineer',
    description: 'A great job',
    adminId: 1,
  };
  const jobResponse = await request(app).post('/api/jobs').send(jobData);
  expect(jobResponse.status).toBe(201);
  const jobId = jobResponse.body.jobId;

  // 2. View all jobs
  const jobsResponse = await request(app).get('/api/jobs');
  expect(jobsResponse.status).toBe(200);
  const job = jobsResponse.body.jobs.find((j) => j.id === jobId);
  expect(job).toBeDefined();

  // 3. View job by id
  const jobViewResponse = await request(app).get(`/api/jobs/${jobId}`);
  expect(jobViewResponse.status).toBe(200);
  expect(jobViewResponse.body.job.id).toBe(jobId);

  // 4. Upload a resume
  const resumePath = path.join(__dirname, '..', 'fixtures', 'resume.pdf');
  const resumeResponse = await request(app).post('/api/resumes').attach('resume', resumePath);
  expect(resumeResponse.status).toBe(201);
  const resumeId = resumeResponse.body.resumeId;

  // 5. Submit an application
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

  // 6. View applications for the job
  const applicationsResponse = await request(app).get(`/api/jobs/${jobId}/applications`);
  expect(applicationsResponse.status).toBe(200);
  expect(applicationsResponse.body.applications.length).toBe(1);
  expect(applicationsResponse.body.applications[0].id).toBe(applicationId);

  // 7. View the application
  const applicationViewResponse = await request(app).get(`/api/applications/${applicationId}`);
  expect(applicationViewResponse.status).toBe(200);
  expect(applicationViewResponse.body.application.id).toBe(applicationId);

  // 8. View the resume
  const resumeViewResponse = await request(app).get(`/api/resumes/${resumeId}`);
  expect(resumeViewResponse.status).toBe(200);
  expect(resumeViewResponse.headers['content-type']).toBe('application/pdf');
  const fileBuffer = fs.readFileSync(resumePath);
  expect(resumeViewResponse.body).toEqual(fileBuffer);

  // 9. Delete the resume
  const deleteResumeResponse = await request(app).delete(`/api/resumes/${resumeId}`);
  expect(deleteResumeResponse.status).toBe(204);

  // 10. Delete the application
  const deleteApplicationResponse = await request(app).delete(`/api/applications/${applicationId}`);
  expect(deleteApplicationResponse.status).toBe(204);

  // 11. Delete the job
  const deleteJobResponse = await request(app).delete(`/api/jobs/${jobId}`);
  expect(deleteJobResponse.status).toBe(204);

  // 12. Verify everything is deleted
  const deletedJobResponse = await request(app).get(`/api/jobs/${jobId}`);
  expect(deletedJobResponse.status).toBe(404);
  const deletedApplicationResponse = await request(app).get(`/api/applications/${applicationId}`);
  expect(deletedApplicationResponse.status).toBe(404);
  const deletedResumeResponse = await request(app).get(`/api/resumes/${resumeId}`);
  expect(deletedResumeResponse.status).toBe(404);
});
