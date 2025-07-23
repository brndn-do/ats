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

describe("POST /api/jobs", () => {
  const jobData = {
    title: "Software Engineer",
    description: "Builds software",
    adminId: 1,
  };
  const mockResolvedValue = { rows: [{ id: 1, ...jobData }], rowCount: 1 };
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
      const {title, ...rest} = jobData;
      const badJobData = {title: 123, ...rest}
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
  it("should get all jobs", async () => {});
  it("should return 500 if db failure", async () => {});
});
describe("GET /api/jobs/:id", () => {
  it("should get a job by its id", async () => {});
  it("should return 400 if id is not int", async () => {});
  it("should return 404 if job is not found", async () => {});
  it("should return 500 if db failure", async () => {});
});
describe("DELETE /api/jobs/:id", () => {
  it("should delete a job and return 204", async () => {});
  it("should return 400 if id is not int", async () => {});
  it("should return 404 if job is not found", async () => {});
  it("should return 500 if db failure", async () => {});
});
