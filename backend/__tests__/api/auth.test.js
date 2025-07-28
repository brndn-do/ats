import request from "supertest";
import app from "../../app.js";
import { Pool } from "pg";
import jwt from "jsonwebtoken";

import dotenv from "dotenv";

dotenv.config();

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

const cred = {
  username: "admin",
  password: "abc123",
};

const expectedPayload = {
  sub: 1,
  name: "admin",
  isAdmin: true,
};

const mockResolvedValue = {
  rows: [
    {
      id: 1,
      username: "admin",
      pwd_hash: "abc123",
      is_admin: true,
    },
  ],
  rowCount: 1,
};

describe("POST /api/auth/login", () => {
  it("should issue correct access token", async () => {
    pool.query.mockResolvedValueOnce(mockResolvedValue);
    const res = await request(app).post("/api/auth/login").send(cred);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged in");
    const payload = jwt.verify(res.body.data, process.env.JWT_SECRET);
    expect(payload).toMatchObject(expectedPayload);
  });
  it("should return 400 if body is missing", async () => {
    pool.query.mockResolvedValueOnce(mockResolvedValue);
    const res = await request(app).post("/api/auth/login");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing body");
    expect(pool.query).not.toHaveBeenCalled();
  });
  describe("missing required fields", () => {
    it("should return 400 if missing username", async () => {});
    it("should return 400 if missing password", async () => {});
  });
  describe("incorrect data type(s) in body", () => {
    it("should return 422 if username is not string", async () => {});
    it("should return 422 if password is not string", async () => {});
  });
  it("should return 401 if user doesn't exist", async () => {});
  it("should return 401 if password is incorrect", async () => {});
  it("should return 500 if db failure", async () => {});
});

describe("POST /api/auth/logout", () => {});

describe("POST /api/auth/refresh", () => {});
