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

const jobId = 1;
const jobData = {
  title: "Software Engineer",
  description: "Builds software",
  adminId: 1,
};

describe("POST /api/jobs", () => {
  const mockResolvedValue = { rows: [{ id: jobId, ...jobData }], rowCount: 1 };
  it("should insert a job and return its data", async () => {
    // Configure mock
    pool.query.mockResolvedValueOnce(mockResolvedValue);

    // Action: post a valid job
    const res = await request(app).post("/api/jobs").send(jobData);

    // Assertions
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.text);
    expect(body.message).toBe("Job posted");
    expect(body.data).toEqual(mockResolvedValue.rows[0]);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
  it("should return 400 if missing body", async () => {
    // Action: send request with no body
    const res = await request(app).post("/api/jobs");

    // Assertions
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Missing body");
    expect(pool.query).toHaveBeenCalledTimes(0); // Verify no query was used
  });
  describe("missing required fields", () => {
    it("should return 422 if missing title", async () => {
      const { title, ...badJobData } = jobData;
      // Action: send request with missing title
      const res = await request(app).post("/api/jobs").send(badJobData);
      // Assertions
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Missing required fields");
      expect(pool.query).toHaveBeenCalledTimes(0); // Verify no query was used
    });
    it("should return 422 if missing description", async () => {
      const { description, ...badJobData } = jobData;
      // Action: send request with missing description
      const res = await request(app).post("/api/jobs").send(badJobData);
      // Assertions
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Missing required fields");
      expect(pool.query).toHaveBeenCalledTimes(0); // Verify no query was used
    });
    it("should return 422 if missing adminId", async () => {
      const { adminId, ...badJobData } = jobData;
      // Action: send request with missing adminId
      const res = await request(app).post("/api/jobs").send(badJobData);
      // Assertions
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Missing required fields");
      expect(pool.query).toHaveBeenCalledTimes(0); // Verify no query was used
    });
  });
  describe("incorrect data type(s) in body", () => {
    it("should return 422 if title is not string", async () => {
      const { title, ...rest } = jobData;
      const badJobData = { title: 123, ...rest };
      // Action: send request with bad title
      const res = await request(app).post("/api/jobs").send(badJobData);
      // Assertions
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Incorrect data type(s) in body");
      expect(pool.query).toHaveBeenCalledTimes(0);
    });
    it("should return 422 if description is not string", async () => {
      const { description, ...rest } = jobData;
      const badJobData = { description: 123, ...rest };
      // Action: send request with bad description
      const res = await request(app).post("/api/jobs").send(badJobData);
      // Assertions
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Incorrect data type(s) in body");
      expect(pool.query).toHaveBeenCalledTimes(0);
    });
    it("should return 422 if adminId is not a number", async () => {
      const { adminId, ...rest } = jobData;
      const badJobData = { adminId: "abc", ...rest };
      // Action: send request with bad adminId
      const res = await request(app).post("/api/jobs").send(badJobData);
      // Assertions
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Incorrect data type(s) in body");
      expect(pool.query).toHaveBeenCalledTimes(0);
    });
    it("should return 422 if adminId is not an integer", async () => {
      const { adminId, ...rest } = jobData;
      const badJobData = { adminId: 1.23, ...rest };
      // Action: send request with bad adminId
      const res = await request(app).post("/api/jobs").send(badJobData);
      // Assertions
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Incorrect data type(s) in body");
      expect(pool.query).toHaveBeenCalledTimes(0);
    });
  });
  it("should return 500 if db failure", async () => {
    // Configure mock
    pool.query.mockRejectedValue(new Error("DB connection error"));

    // Action: post a valid job
    const res = await request(app).post("/api/jobs").send(jobData);

    // Assertions
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Internal server error");
  });
});

describe("GET /api/jobs", () => {
  const mockResolvedValue = { rows: [{ id: 1, ...jobData }], rowCount: 1 };

  it("should get all jobs", async () => {
    // Configure mock
    pool.query.mockResolvedValueOnce(mockResolvedValue);

    // Action: get all jobs
    const res = await request(app).get("/api/jobs");

    // Assertions
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.text);
    expect(body.message).toBe("Jobs retrieved");
    expect(body.data).toEqual(mockResolvedValue.rows);
  });

  it("should return 500 if db failure", async () => {
    // Configure mock
    pool.query.mockRejectedValue(new Error("DB connection error"));

    // Action: get all jobs
    const res = await request(app).get("/api/jobs");

    // Assertions
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Internal server error");
  });
});

describe("GET /api/jobs/:id", () => {
  const mockResolvedValue = { rows: [{id: jobId, ...jobData }], rowCount: 1};

  it("should get a job by its id", async () => {
    // Configure Mock
    pool.query.mockResolvedValueOnce(mockResolvedValue);
    
    // Action: get job by id
    const res = await request(app).get(`/api/jobs/${jobId}`);

    // Assertions
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.text);
    expect(body.message).toBe("Job retrieved");
    expect(body.data).toEqual(mockResolvedValue.rows[0]);
  });

  it("should return 400 if id is not number", async () => {
    // Action: request with invalid job id
    const res = await request(app).get(`/api/jobs/num1`);

    // Assertions
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Invalid job ID");
    expect(pool.query).toHaveBeenCalledTimes(0);
  });

  it("should return 400 if id is not an integer", async () => {
    // Action: request with invalid job id
    const res = await request(app).get(`/api/jobs/1.23`);

    // Assertions
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Invalid job ID");
    expect(pool.query).toHaveBeenCalledTimes(0);
  });

  it("should return 404 if job is not found", async () => {
    // Configure mock to find nothing
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    // Action: send request for job that doesn't exist
    const res = await request(app).get("/api/jobs/999");

    // Assertions
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Job not found");
  });

  it("should return 500 if db failure", async () => {
    // Configure mock
    pool.query.mockRejectedValue(new Error("DB connection error"));

    // Action: send request
    const res = await request(app).get("/api/jobs/1");

    // Assertions
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Internal server error");
  });
});

describe("DELETE /api/jobs/:id", () => {
  it("should delete a job and return 204", async () => {
    // Configure mock
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    // Action: delete a job
    const res = await request(app).delete(`/api/jobs/${jobId}`);

    // Assertions
    expect(res.statusCode).toBe(204);
    expect(res.body).toEqual({});
  });

  it("should return 400 if id is not int", async () => {
    // Action: send request with non-int id
    const res = await request(app).delete("/api/jobs/abc");

    // Assertions
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Invalid job ID");
    expect(pool.query).toHaveBeenCalledTimes(0);
  });

  it("should return 404 if job is not found", async () => {
    // Configure mock to find nothing
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    // Action: send request for job that doesn't exist
    const res = await request(app).delete("/api/jobs/999");

    // Assertions
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Job not found");
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it("should return 500 if db failure", async () => {
    // Configure mock
    pool.query.mockRejectedValue(new Error("DB connection error"));

    // Action: send request
    const res = await request(app).delete("/api/jobs/1");

    // Assertions
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("Internal server error");
  });
});
