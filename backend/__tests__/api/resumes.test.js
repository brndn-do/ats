import request from "supertest";
import app from "../../app.js";
import path from "path";

import { Pool } from "pg";
import { Readable } from "stream";

// Mocks the `pg` module. `new Pool()` will always return the same singleton
// mock object, allowing tests to configure its behavior for database calls.
jest.mock("pg", () => {
  const mPool = { query: jest.fn() };
  return { Pool: jest.fn(() => mPool) };
});

// Mocks the S3 client. The `send` method is a mock function, preventing
// actual AWS calls. This allows tests to simulate S3 operations.
jest.mock("@aws-sdk/client-s3", () => {
  const mSend = jest.fn();
  const mS3Client = jest.fn(() => ({
    send: mSend,
  }));
  // Expose mSend as a static property on the mock S3Client constructor
  mS3Client.mSend = mSend;
  return {
    S3Client: mS3Client,
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
  };
});

describe("Root route test", () => {
  it("GET / should retrieve status: ok message: ATS API", async () => {
    // Action: send GET request to root route
    const res = await request(app).get("/");
    // Assertions
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.text);
    expect(body.status).toBe("ok");
    expect(body.message).toBe("ATS API");
  });
});

describe("API /api/resumes", () => {
  const fakeResumeId = 123;
  const fakeResumeFileName = "resume.pdf";
  const fakeObjectKey = "abc.pdf";

  const pool = new Pool();
  const S3Client = require("@aws-sdk/client-s3").S3Client;
  beforeEach(() => {
    pool.query.mockClear();
    S3Client.mSend.mockClear();
  });

  describe("POST /api/resumes", () => {
    it("should upload a new resume and return its data", async () => {
      // Configure mock for DB calls
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: fakeResumeId,
            original_filename: fakeResumeFileName,
            object_key: fakeObjectKey,
          },
        ],
        rowCount: 1,
      });
      // Configure S3 mock for the upload (from POST)
      S3Client.mSend.mockResolvedValue({}); // Ensure it returns a resolved promise

      // Action: Upload a valid resume
      const res = await request(app)
        .post("/api/resumes")
        .attach(
          "resume",
          path.join(__dirname, "..", "fixtures", fakeResumeFileName)
        );

      // Assertions
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.text);
      expect(body.message).toBe("Resume posted");
      expect(body.data.id).toBe(fakeResumeId);
      expect(body.data.original_filename).toBe(fakeResumeFileName);
      expect(body.data.object_key).toBe(fakeObjectKey);
      expect(pool.query).toHaveBeenCalledTimes(1); // Verify DB was called
    });
    it("should return 400 if missing file", async () => {
      // Action: send request with no file
      const res = await request(app).post("/api/resumes");
      // Assertions
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Missing file");
      expect(pool.query).toHaveBeenCalledTimes(0); // Verify no query was used
    });
    it("should return 400 if file is non-pdf", async () => {
      // Action: upload non-pdf
      const res = await request(app)
        .post("/api/resumes")
        .attach("resume", path.join(__dirname, "..", "fixtures", "resume.txt"));
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.text);
      expect(body.error).toBe("Received non-PDF file");
      expect(pool.query).toHaveBeenCalledTimes(0); // Verify no query was used
    });
  });

  describe("GET /api/resumes/:id", () => {
    it("should retrieve a specific resume", async () => {
      // Configure mock for DB calls
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: fakeResumeId,
            original_filename: fakeResumeFileName,
            object_key: fakeObjectKey,
          },
        ],
        rowCount: 1,
      });
      // Configure S3 mock for the download
      const mockPdfStream = Readable.from(["fake pdf content"]);
      S3Client.mSend.mockResolvedValue({
        ContentType: "application/pdf",
        Body: mockPdfStream,
      });

      // Action: Download the resume
      const res = await request(app).get(`/api/resumes/${fakeResumeId}`);

      // Assertions
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.body.toString()).toBe("fake pdf content"); // Changed from res.text
      expect(pool.query).toHaveBeenCalledTimes(1); // Verify DB was called
      expect(S3Client.mSend).toHaveBeenCalledTimes(1); // Verify S3 was called
    });
  });

  describe("DELETE /api/resumes/:id", () => {
    it("should delete a resume and return 204", async () => {
      // Configure mock for DB calls
      // First call to find the object key
      pool.query.mockResolvedValueOnce({
        rows: [{ object_key: fakeObjectKey }],
        rowCount: 1,
      });
      // Second call for the delete
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: fakeResumeId,
            original_filename: fakeResumeFileName,
            object_key: fakeObjectKey,
          },
        ],
        rowCount: 1,
      });

      // Action: Delete the resume
      const res = await request(app).delete(`/api/resumes/${fakeResumeId}`);

      // Assertions
      expect(res.statusCode).toBe(204);
      expect(res.body).toEqual({});
      expect(pool.query).toHaveBeenCalledTimes(2); // Verify DB was called twice: verify it exists, then delete
    });

    it("should return 404 if the resume to delete is not found", async () => {
      // Configure mock for DB calls to find nothing
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Action: Delete the resume
      const res = await request(app).delete(`/api/resumes/9999`);

      // Assertions
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe("Resume not found");
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it("should return 400 if the ID is not a valid integer", async () => {
      // Action: Delete the resume with invalid id
      const res = await request(app).delete(`/api/resumes/abc`);

      // Assertions
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe("Invalid resume ID");
      expect(pool.query).not.toHaveBeenCalled();
    });
  });
});
