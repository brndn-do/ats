import request from "supertest";
import app from "../../app.js";

import { Pool } from "pg";

// Mocks the `pg` module. `new Pool()` will always return the same singleton
// mock object, allowing tests to configure its behavior for database calls.
jest.mock("pg", () => {
  const mPool = { query: jest.fn() };
  return { Pool: jest.fn(() => mPool) };
});

const pool = new Pool();
beforeEach(() => {
  pool.query.mockReset();
});

describe("POST /api/jobs/:id/applications", () => {
  const jobId = 1;
  const applicationData = {
    applicantName: "John Doe",
    applicantEmail: "john.doe@example.com",
    resumeId: 123,
  };

  describe("assume all three queries will be successful and everything exists in db", () => {
    beforeEach(() => {
      // Mock job exists check
      pool.query.mockResolvedValueOnce({ rows: [{ id: jobId }], rowCount: 1 });
      // Mock resume exists check
      pool.query.mockResolvedValueOnce({
        rows: [{ id: applicationData.resumeId }],
        rowCount: 1,
      });
      // Mock insert application
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...applicationData, job_id: jobId }],
        rowCount: 1,
      });
    });

    it("should insert an application and return its data", async () => {
      const res = await request(app)
        .post(`/api/jobs/${jobId}/applications`)
        .send(applicationData);

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.text);
      expect(body.message).toBe("Application posted");
      expect(body.data.applicantName).toBe(applicationData.applicantName);
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it("should return 400 if job id is not a number", async () => {
      const res = await request(app)
        .post(`/api/jobs/abc/applications`)
        .send(applicationData);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Invalid Job ID");
      expect(pool.query).not.toHaveBeenCalled();
    });

    it("should return 400 if job id is not an integer", async () => {
      const res = await request(app)
        .post(`/api/jobs/1.23/applications`)
        .send(applicationData);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Invalid Job ID");
      expect(pool.query).not.toHaveBeenCalled();
    });

    it("should return 400 if missing body", async () => {
      const res = await request(app).post(`/api/jobs/${jobId}/applications`);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Missing body");
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it("should return 422 if missing required fields", async () => {
      const { applicantName, ...badData } = applicationData;
      const res = await request(app)
        .post(`/api/jobs/${jobId}/applications`)
        .send(badData);

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Missing required fields");
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it("should return 422 if incorrect data type(s) in body", async () => {
      const badData = { ...applicationData, resumeId: "abc" };
      const res = await request(app)
        .post(`/api/jobs/${jobId}/applications`)
        .send(badData);

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Incorrect data type(s) in body");
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe("assume all three queries will be successful but one resource won't be found", () => {
    it("should return 404 if job is not found", async () => {
      // Mock job exists check to return nothing
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // Mock resume exists check
      pool.query.mockResolvedValueOnce({
        rows: [{ id: applicationData.resumeId }],
        rowCount: 1,
      });
      // Mock insert application
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...applicationData, job_id: jobId }],
        rowCount: 1,
      });
  
      const res = await request(app)
        .post(`/api/jobs/999/applications`)
        .send(applicationData);
  
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Job not found");
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  
    it("should return 404 if resume not found", async () => {
      // Mock job exists check
      pool.query.mockResolvedValueOnce({ rows: [{ id: jobId }], rowCount: 1 });
      // Mock resume exists check to return nothing
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // Mock insert application
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, ...applicationData, job_id: jobId }],
        rowCount: 1,
      });
  
      const res = await request(app)
        .post(`/api/jobs/${jobId}/applications`)
        .send(applicationData);
  
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Resume not found ");
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  })

  it("should return 500 if first db query fails (job check)", async () => {
    pool.query.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .post(`/api/jobs/${jobId}/applications`)
      .send(applicationData);

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Internal server error");
  });

  it("should return 500 if second db query fails (resume check)", async () => {
    // Mock job exists check
    pool.query.mockResolvedValueOnce({ rows: [{ id: jobId }], rowCount: 1 });
    // Mock resume check to fail
    pool.query.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .post(`/api/jobs/${jobId}/applications`)
      .send(applicationData);

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Internal server error");
  });

  it("should return 500 if third db query fails (insert)", async () => {
    // Mock job exists check
    pool.query.mockResolvedValueOnce({ rows: [{ id: jobId }], rowCount: 1 });
    // Mock resume exists check
    pool.query.mockResolvedValueOnce({
      rows: [{ id: applicationData.resumeId }],
      rowCount: 1,
    });
    // Mock insert to fail
    pool.query.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .post(`/api/jobs/${jobId}/applications`)
      .send(applicationData);

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Internal server error");
  });
});

describe("GET /api/jobs/:id/applications", () => {
  const jobId = 1;
  const applicationsData = [
    { id: 1, applicant_name: 'John Doe', applicant_email: 'john.doe@example.com', resume_id: 123, job_id: jobId },
    { id: 2, applicant_name: 'Jane Doe', applicant_email: 'jane.doe@example.com', resume_id: 456, job_id: jobId },
  ];

  it("should get all applications for a job", async () => {
    // Mock job exists check
    pool.query.mockResolvedValueOnce({ rows: [{ id: jobId }], rowCount: 1 });
    // Mock get applications
    pool.query.mockResolvedValueOnce({ rows: applicationsData, rowCount: applicationsData.length });

    const res = await request(app).get(`/api/jobs/${jobId}/applications`);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.text);
    expect(body.message).toBe(`Retrived applications for job ${jobId}`);
    expect(body.data).toEqual(applicationsData);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it("should return 400 if job id is not a number", async () => {
    const res = await request(app).get(`/api/jobs/abc/applications`);

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Invalid job ID");
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("should return 400 if job id is not an integer", async () => {
    const res = await request(app).get(`/api/jobs/1.23/applications`);

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Invalid job ID");
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("should return 404 if job is not found", async () => {
    // Mock job exists check to return nothing
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app).get(`/api/jobs/999/applications`);

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Job not found");
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it("should return 500 if job query fails", async () => {
    pool.query.mockRejectedValue(new Error("DB error"));

    const res = await request(app).get(`/api/jobs/${jobId}/applications`);

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Internal server error");
  });

  it("should return 500 if applications query fails", async () => {
    // Mock job exists check
    pool.query.mockResolvedValueOnce({ rows: [{ id: jobId }], rowCount: 1 });
    // Mock applications query to fail
    pool.query.mockRejectedValue(new Error("DB error"));

    const res = await request(app).get(`/api/jobs/${jobId}/applications`);

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Internal server error");
  });
});

describe("GET /api/aplications/:id", () => {});

describe("DELETE /api/aplications/:id", () => {});
