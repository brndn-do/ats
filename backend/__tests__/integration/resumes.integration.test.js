import request from 'supertest';
import app from '../../src/app.js';
import queryWithRetry, { pool } from '../../src/services/db';
import { client, emptyBucket } from '../../src/services/s3';
import path from 'path';
import fs from 'fs';

// Clean up resumes table and bucket before test
beforeAll(async () => {
  await queryWithRetry('TRUNCATE TABLE resumes RESTART IDENTITY CASCADE');
  await emptyBucket();
});

// close DB pool and S3 client
afterAll(() => {
  pool.end();
  client.destroy();
});

it('should complete the full lifecycle of a resume', async () => {
  const fileName = 'resume.pdf';
  const filePath = path.join(__dirname, '..', 'fixtures', fileName);
  const fileBuffer = fs.readFileSync(filePath);

  // 1. Upload resume
  const postRes = await request(app).post('/api/resumes').attach('resume', filePath);
  expect(postRes.status).toBe(201);
  const id = postRes.body.resumeId;
  expect(id).toEqual(expect.any(Number));

  // 2. GET resume by its id
  const getRes = await request(app).get(`/api/resumes/${id}`);
  expect(getRes.statusCode).toBe(200);
  expect(getRes.headers['content-type']).toBe('application/pdf');
  expect(getRes.body).toEqual(fileBuffer);

  // 3. DELETE resume by id
  const deleteRes = await request(app).delete(`/api/resumes/${id}`);
  expect(deleteRes.statusCode).toBe(204);

  // 4. GET the resume again and assert 404
  const getAfterDeleteRes = await request(app).get(`/api/resumes/${id}`);
  expect(getAfterDeleteRes.statusCode).toBe(404);
  expect(getAfterDeleteRes.body.error).toBe('Resume not found');
});
