import request from "supertest";
import app from "../../app.js";
import queryWithRetry, { pool } from "../../db.js";

// Clean up the jobs table before test
beforeAll(async () => {
  await queryWithRetry("TRUNCATE TABLE jobs RESTART IDENTITY CASCADE");
});

// close DB pool
afterAll( async () => {
  await pool.end();
});

it("should complete the full lifecycle of a job", async () => {
  const jobData = {
    title: "Integration Test Job",
    description: "This is a job for integration testing.",
    adminId: 1, // camelCase
  };
  const expectedDBResult = {
    title: "Integration Test Job",
    description: "This is a job for integration testing.",
    admin_id: 1, // snake_case
  };
  let createdJobId;

  // 1. POST a new job
  const postRes = await request(app).post("/api/jobs").send(jobData);
  expect(postRes.statusCode).toBe(201);
  expect(postRes.body.message).toBe("Job posted");
  expect(postRes.body.data).toMatchObject(expectedDBResult);
  createdJobId = postRes.body.data.id;
  expect(createdJobId).toBeDefined();

  // 2. GET all jobs and assert the new job is there
  const getAllRes = await request(app).get("/api/jobs");
  expect(getAllRes.statusCode).toBe(200);
  expect(getAllRes.body.message).toBe("Jobs retrieved");
  const jobs = getAllRes.body.data;
  const foundJob = jobs.find((job) => job.id === createdJobId);
  expect(foundJob).toMatchObject(expectedDBResult);

  // 3. GET that specific job by ID and assert its data
  const getByIdRes = await request(app).get(`/api/jobs/${createdJobId}`);
  expect(getByIdRes.statusCode).toBe(200);
  expect(getByIdRes.body.message).toBe("Job retrieved");
  expect(getByIdRes.body.data).toMatchObject(expectedDBResult);

  // 4. DELETE the job by ID
  const deleteRes = await request(app).delete(`/api/jobs/${createdJobId}`);
  expect(deleteRes.statusCode).toBe(204);

  // 5. GET the job again and assert 404
  const getAfterDeleteRes = await request(app).get(`/api/jobs/${createdJobId}`);
  expect(getAfterDeleteRes.statusCode).toBe(404);
  expect(getAfterDeleteRes.body.error).toBe("Job not found");
});
