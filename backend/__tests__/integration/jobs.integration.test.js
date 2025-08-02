import request from 'supertest';
import app from '../../src/app.js';
import queryWithRetry, { pool } from '../../src/services/db.js';

// Clean up the jobs table before test
beforeAll(async () => {
  await queryWithRetry('TRUNCATE TABLE jobs RESTART IDENTITY CASCADE');
});

// close DB pool
afterAll(async () => {
  await pool.end();
});

it('should complete the full lifecycle of a job', async () => {
  const jobData = {
    title: 'Integration Test Job',
    description: 'This is a job for integration testing.',
    adminId: 1, // camelCase
  };
  const expectedDBResult = {
    title: 'Integration Test Job',
    description: 'This is a job for integration testing.',
    admin_id: 1, // snake_case
  };

  // 1. POST a new job
  const postRes = await request(app).post('/api/jobs').send(jobData);
  expect(postRes.status).toBe(201);
  const createdJobId = postRes.body.jobId;
  expect(createdJobId).toEqual(expect.any(Number));

  // 2. GET all jobs and assert the new job is there
  const getAllRes = await request(app).get('/api/jobs');
  expect(getAllRes.status).toBe(200);
  const jobs = getAllRes.body.jobs;
  const foundJob = jobs.find((job) => job.id === createdJobId);
  expect(foundJob).toMatchObject(expectedDBResult);

  // 3. GET that specific job by ID and assert its data
  const getByIdRes = await request(app).get(`/api/jobs/${createdJobId}`);
  expect(getByIdRes.status).toBe(200);
  expect(getByIdRes.body.job).toMatchObject(expectedDBResult);

  // 4. DELETE the job by ID
  const deleteRes = await request(app).delete(`/api/jobs/${createdJobId}`);
  expect(deleteRes.status).toBe(204);

  // 5. GET the job again and assert 404
  const getAfterDeleteRes = await request(app).get(`/api/jobs/${createdJobId}`);
  expect(getAfterDeleteRes.status).toBe(404);
  expect(getAfterDeleteRes.body.error).toBe('Job not found');
});
