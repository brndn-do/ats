import request from 'supertest';
import app from '../../src/app.js';
import path from 'path';
import { Pool } from 'pg';
import { Readable } from 'stream';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import createTokens from '../../src/utils/createTokens.js';

// Mocks the `pg` module. `new Pool()` will always return the same singleton
// mock object, allowing tests to configure its behavior for database calls.
jest.mock('pg', () => {
  const mPool = { query: jest.fn() };

  return { Pool: jest.fn(() => mPool) };
});

// Mocks the S3 client. The `send` method is a mock function, preventing
// actual AWS calls. This allows tests to simulate S3 operations.
jest.mock('@aws-sdk/client-s3', () => {
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

const fakeResumeId = 123;
const fakeResumeFileName = 'resume.pdf';
const fakeObjectKey = 'abc.pdf';

// access token for admin user (rename to `adminAccess`)
const { accessToken: adminAccess } = createTokens(1, 'admin', true);
// access token for non-admin user (rename to 'nonAdminAccess`)
const { accessToken: nonAdminAccess } = createTokens(2, 'user', false);

const pool = new Pool();
const S3Client = require('@aws-sdk/client-s3').S3Client;
beforeEach(() => {
  pool.query.mockReset();
  S3Client.mSend.mockReset();
});

describe('POST /api/resumes', () => {
  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // Configure S3 mock for the upload
      S3Client.mSend.mockResolvedValue({}); // Ensure it returns a resolved promise

      // Configure mock for DB insert
      pool.query.mockResolvedValueOnce({
        rows: [{ id: fakeResumeId }],
        rowCount: 1,
      });

      // Upload a valid resume
      res = await request(app)
        .post('/api/resumes')
        .attach('resume', path.join(__dirname, '..', 'fixtures', fakeResumeFileName));
    });

    // tests
    it('should return 201', () => {
      expect(res.status).toBe(201);
    });
    it('should upload to object storage', () => {
      expect(PutObjectCommand).toHaveBeenCalled();
    });
    it('should save info to db', () => {
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO resumes/i), [
        fakeResumeFileName,
        expect.any(String),
      ]);
    });
    it('should return its database id', () => {
      expect(res.body.resumeId).toBe(fakeResumeId);
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if missing file', async () => {
      const res = await request(app).post('/api/resumes');
      expect(res.status).toBe(400);
    });
    it('should return 400 if file is non-pdf', async () => {
      const res = await request(app)
        .post('/api/resumes')
        .attach('resume', path.join(__dirname, '..', 'fixtures', 'resume.txt'));
      expect(res.status).toBe(400);
    });
  });

  describe('Internal errors', () => {
    it('should return 500 if DB fails', async () => {
      // Configure S3 mock for the upload (from POST)
      S3Client.mSend.mockResolvedValue({}); // Ensure it returns a resolved promise
      // mock DB ERROR
      pool.query.mockRejectedValue(new Error());

      // upload a valid resume
      const res = await request(app)
        .post('/api/resumes')
        .attach('resume', path.join(__dirname, '..', 'fixtures', fakeResumeFileName));

      expect(res.status).toBe(500);
    });
    it('should return 500 if S3 fails', async () => {
      // Configure mock for DB insert
      pool.query.mockResolvedValueOnce({
        rows: [{ id: fakeResumeId }],
        rowCount: 1,
      });
      // mock S3 ERROR
      S3Client.mSend.mockRejectedValue(new Error());

      // upload a valid resume
      const res = await request(app)
        .post('/api/resumes')
        .attach('resume', path.join(__dirname, '..', 'fixtures', fakeResumeFileName));

      expect(res.status).toBe(500);
    });
  });
});

describe('GET /api/resumes/:id', () => {
  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // mock DB
      pool.query.mockResolvedValueOnce({
        rows: [{ original_filename: fakeResumeFileName, object_key: fakeObjectKey }],
        rowCount: 1,
      });
      // mock S3 downlaod
      const mockPdfStream = Readable.from(['fake pdf content']);
      S3Client.mSend.mockResolvedValue({
        ContentType: 'application/pdf',
        Body: mockPdfStream,
      });
      // download the resume
      res = await request(app)
        .get(`/api/resumes/${fakeResumeId}`)
        .set('Authorization', `Bearer ${adminAccess}`);
    });

    // tests
    it('should return 200', async () => {
      expect(res.status).toBe(200);
    });

    it('should retrieve the resume', async () => {
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.body.toString()).toBe('fake pdf content');
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if id is not a number', async () => {
      const res = await request(app)
        .get('/api/resumes/abc')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 if id is not an integer', async () => {
      const res = await request(app)
        .get('/api/resumes/1.1')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Authorization', () => {
    it('should return 401 if no token', async () => {
      // no token
      res = await request(app).get(`/api/resumes/${fakeResumeId}`);
      expect(res.status).toBe(401);
    });

    it('should return 403 if not admin', async () => {
      res = await request(app)
        .get(`/api/resumes/${fakeResumeId}`)
        .set('Authorization', `Bearer ${nonAdminAccess}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Not found', () => {
    it('should return 404 if resume does not exist', async () => {
      // mock resume not found
      pool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const res = await request(app)
        .get(`/api/resumes/${fakeResumeId}`)
        .set('Authorization', `Bearer ${adminAccess}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Internal errors', () => {
    it('should return 500 if DB fails', async () => {
      // mock DB ERROR
      pool.query.mockRejectedValue(new Error());

      // mock S3 download
      const mockPdfStream = Readable.from(['fake pdf content']);
      S3Client.mSend.mockResolvedValue({
        ContentType: 'application/pdf',
        Body: mockPdfStream,
      });

      // download the resume
      const res = await request(app)
        .get(`/api/resumes/${fakeResumeId}`)
        .set('Authorization', `Bearer ${adminAccess}`);

      expect(res.status).toBe(500);
    });
    it('should return 500 if S3 fails', async () => {
      // mock DB
      pool.query.mockResolvedValueOnce({
        rows: [{ original_filename: fakeResumeFileName, object_key: fakeObjectKey }],
        rowCount: 1,
      });

      // mock S3 ERROR
      S3Client.mSend.mockRejectedValue(new Error());

      // download the resume
      const res = await request(app)
        .get(`/api/resumes/${fakeResumeId}`)
        .set('Authorization', `Bearer ${adminAccess}`);

      expect(res.status).toBe(500);
    });
  });
});

describe('DELETE /api/resumes/:id', () => {
  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // mock DB delete
      pool.query.mockResolvedValueOnce({
        rows: [{ object_key: fakeObjectKey }],
        rowCount: 1,
      });
      // delete the resume
      res = await request(app).delete(`/api/resumes/${fakeResumeId}`);
    });

    // tests
    it('should return 204', async () => {
      expect(res.status).toBe(204);
    });

    it('should delete the resume object', async () => {
      expect(DeleteObjectCommand).toHaveBeenCalled();
    });

    it('should delete the resume from db', async () => {
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM resumes/i), [
        fakeResumeId,
      ]);
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if the ID is not number', async () => {
      const res = await request(app).delete(`/api/resumes/abc`);
      expect(res.status).toBe(400);
    });

    it('should return 400 if the ID is not an integer', async () => {
      const res = await request(app).delete(`/api/resumes/1.1`);
      expect(res.status).toBe(400);
    });
  });

  describe('Not found', () => {
    it('should return 404 if the resume to delete is not found', async () => {
      // mock resume not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await request(app).delete(`/api/resumes/9999`);
      expect(res.status).toBe(404);
    });
  });

  it('should return 500 if DB failure', async () => {
    // mock DB error
    pool.query.mockRejectedValue(new Error('DB connection error'));
    const res = await request(app).delete(`/api/resumes/${fakeResumeId}`);
    expect(res.status).toBe(500);
  });

  it('should return 500 if S3 failure', async () => {
    // mock db delete
    pool.query.mockResolvedValueOnce({
      rows: [{ object_key: fakeObjectKey }],
      rowCount: 1,
    });
    // mock S3 error
    S3Client.mSend.mockRejectedValue(new Error('S3 connection error'));
    const res = await request(app).delete(`/api/resumes/${fakeResumeId}`);
    expect(res.status).toBe(500);
  });
});
