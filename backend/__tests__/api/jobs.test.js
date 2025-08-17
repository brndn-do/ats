import request from 'supertest';
import app from '../../src/app.js';
import { Pool } from 'pg';
import createTokens from '../../src/utils/createTokens.js';

// Mocks the `pg` module. `new Pool()` will always return the same singleton
// mock object, allowing tests to configure its behavior for database calls.
jest.mock('pg', () => {
  const mPool = { query: jest.fn() };

  return { Pool: jest.fn(() => mPool) };
});

const pool = new Pool();
beforeEach(() => {
  pool.query.mockReset();
});

const jobId = 1;
const jobData = {
  title: 'Software Engineer',
  description: 'Builds software',
  adminId: 1,
};

// access token for admin user (rename to `adminAccess`)
const { accessToken: adminAccess } = createTokens(1, 'admin', true);
// access token for non-admin user (rename to 'nonAdminAccess`)
const { accessToken: nonAdminAccess } = createTokens(2, 'user', false);
// access token set to expire immediately
const { accessToken: expiredAccess } = createTokens(3, 'expired', true, '0m');

describe('POST /api/jobs', () => {
  const queryResult = { rows: [{ id: jobId }], rowCount: 1 };

  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // mock DB query
      pool.query.mockResolvedValueOnce(queryResult);
      // post a valid job
      res = await request(app)
        .post('/api/jobs')
        .send(jobData)
        .set('Authorization', `Bearer ${adminAccess}`);
    });

    // tests
    it('should return 201', async () => {
      expect(res.status).toBe(201);
    });

    it('should return its ID', async () => {
      expect(res.body.jobId).toEqual(jobId);
    });

    it('should insert the job', async () => {
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO jobs/i), [
        jobData.title,
        jobData.description,
        jobData.adminId,
      ]);
    });
  });

  describe('Authorization', () => {
    it('should return 401 if missing token', async () => {
      const res = await request(app).post('/api/jobs').send(jobData);
      expect(res.status).toBe(401);
    });
    it('should return 403 if not admin', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send(jobData)
        .set('Authorization', `Bearer ${nonAdminAccess}`);
      expect(res.status).toBe(403);
    });
    it('should return 401 if token is expired', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send(jobData)
        .set('Authorization', `Bearer ${expiredAccess}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if missing body', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });
    describe('missing required fields', () => {
      it('should return 422 if missing title', async () => {
        // eslint-disable-next-line no-unused-vars
        const { title, ...badJobData } = jobData;
        // send with title missing
        const res = await request(app)
          .post('/api/jobs')
          .send(badJobData)
          .set('Authorization', `Bearer ${adminAccess}`);
        expect(res.status).toBe(422);
      });
      it('should return 422 if missing description', async () => {
        // eslint-disable-next-line no-unused-vars
        const { description, ...badJobData } = jobData;
        // send with missing description
        const res = await request(app)
          .post('/api/jobs')
          .send(badJobData)
          .set('Authorization', `Bearer ${adminAccess}`);
        expect(res.status).toBe(422);
      });
      it('should return 422 if missing adminId', async () => {
        // eslint-disable-next-line no-unused-vars
        const { adminId, ...badJobData } = jobData;
        // send with missing adminId
        const res = await request(app)
          .post('/api/jobs')
          .send(badJobData)
          .set('Authorization', `Bearer ${adminAccess}`);
        expect(res.status).toBe(422);
      });
    });
    describe('incorrect data type(s) in body', () => {
      it('should return 422 if title is not string', async () => {
        // eslint-disable-next-line no-unused-vars
        const { title, ...rest } = jobData;
        const badJobData = { title: 123, ...rest };
        // send with bad title
        const res = await request(app)
          .post('/api/jobs')
          .send(badJobData)
          .set('Authorization', `Bearer ${adminAccess}`);
        expect(res.status).toBe(422);
      });
      it('should return 422 if description is not string', async () => {
        // eslint-disable-next-line no-unused-vars
        const { description, ...rest } = jobData;
        const badJobData = { description: 123, ...rest };
        // send with bad description
        const res = await request(app)
          .post('/api/jobs')
          .send(badJobData)
          .set('Authorization', `Bearer ${adminAccess}`);
        expect(res.status).toBe(422);
      });
      it('should return 422 if adminId is not a number', async () => {
        // eslint-disable-next-line no-unused-vars
        const { adminId, ...rest } = jobData;
        const badJobData = { adminId: 'abc', ...rest };
        // send request with bad adminId
        const res = await request(app)
          .post('/api/jobs')
          .send(badJobData)
          .set('Authorization', `Bearer ${adminAccess}`);
        expect(res.status).toBe(422);
      });
      it('should return 422 if adminId is not an integer', async () => {
        // eslint-disable-next-line no-unused-vars
        const { adminId, ...rest } = jobData;
        const badJobData = { adminId: 1.23, ...rest };
        // send with bad adminId
        const res = await request(app)
          .post('/api/jobs')
          .send(badJobData)
          .set('Authorization', `Bearer ${adminAccess}`);
        expect(res.status).toBe(422);
      });
    });
  });

  describe('Internal error', () => {
    it('should return 500 if db failure', async () => {
      // mock DB failure
      pool.query.mockRejectedValue(new Error());
      const res = await request(app)
        .post('/api/jobs')
        .send(jobData)
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(500);
    });
  });
});

describe('GET /api/jobs', () => {
  const queryResult = { rows: [{ id: 1, ...jobData }], rowCount: 1 };

  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // mock DB query
      pool.query.mockResolvedValueOnce(queryResult);
      res = await request(app).get('/api/jobs');
    });

    // tests
    it('should return 200', async () => {
      expect(res.status).toBe(200);
    });

    it('should get all jobs', async () => {
      expect(res.body.jobs).toEqual(queryResult.rows);
    });
  });

  describe('Internal error', () => {
    it('should return 500 if db failure', async () => {
      // mock DB failure
      pool.query.mockRejectedValue(new Error());
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(500);
    });
  });
});

describe('GET /api/jobs/:id', () => {
  const queryResult = { rows: [{ id: jobId, ...jobData }], rowCount: 1 };

  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // mock DB query
      pool.query.mockResolvedValueOnce(queryResult);
      res = await request(app).get(`/api/jobs/${jobId}`);
    });

    // tests
    it('should return 200', async () => {
      expect(res.status).toBe(200);
    });

    it('should get the job', async () => {
      expect(res.body.job).toEqual(queryResult.rows[0]);
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if id is not number', async () => {
      // request with invalid job id
      const res = await request(app).get(`/api/jobs/num1`);
      expect(res.status).toBe(400);
    });

    it('should return 400 if id is not an integer', async () => {
      // request with invalid job id
      const res = await request(app).get(`/api/jobs/1.23`);
      expect(res.status).toBe(400);
    });
  });

  describe('Not found', () => {
    it('should return 404 if job is not found', async () => {
      // mock job not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // send request for job that doesn't exist
      const res = await request(app).get('/api/jobs/999');
      expect(res.status).toBe(404);
    });
  });

  describe('Internal error', () => {
    it('should return 500 if db failure', async () => {
      // mock db failure
      pool.query.mockRejectedValue(new Error());
      const res = await request(app).get('/api/jobs/1');
      expect(res.status).toBe(500);
    });
  });
});

describe('DELETE /api/jobs/:id', () => {
  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // mock DB delete
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // delete the job
      res = await request(app)
        .delete(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminAccess}`);
    });

    // tests
    it('should return 204', async () => {
      expect(res.status).toBe(204);
    });

    it('should delete the job from DB', async () => {
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM jobs/i), [jobId]);
    });
  });

  describe('Authorization', () => {
    it('should return 401 if missing token', async () => {
      const res = await request(app).delete(`/api/jobs/${jobId}`);
      expect(res.status).toBe(401);
    });
    it('should return 403 if not admin', async () => {
      const res = await request(app)
        .delete(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${nonAdminAccess}`);
      expect(res.status).toBe(403);
    });
    it('should return 401 if token is expired', async () => {
      const res = await request(app)
        .delete(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${expiredAccess}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if id is not a number', async () => {
      const res = await request(app)
        .delete('/api/jobs/abc')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 if id is not an integer', async () => {
      const res = await request(app)
        .delete('/api/jobs/1.23')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Not found', () => {
    it('should return 404 if job is not found', async () => {
      // mock job not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // send request for job that doesn't exist
      const res = await request(app)
        .delete('/api/jobs/999')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Internal error', () => {
    it('should return 500 if db failure', async () => {
      // mock db failure
      pool.query.mockRejectedValue(new Error());
      const res = await request(app)
        .delete('/api/jobs/1')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(500);
    });
  });
});
