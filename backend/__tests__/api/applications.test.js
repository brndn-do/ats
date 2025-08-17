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

// access token for admin user (rename to `adminAccess`)
const { accessToken: adminAccess } = createTokens(1, 'admin', true);
// access token for non-admin user (rename to 'nonAdminAccess`)
const { accessToken: nonAdminAccess } = createTokens(2, 'user', false);
// access token set to expire immediately
const { accessToken: expiredAccess } = createTokens(3, 'expired', true, '0m');

describe('POST /api/jobs/:id/applications', () => {
  const jobId = 1;
  const applicationData = {
    applicantName: 'John Doe',
    applicantEmail: 'john.doe@example.com',
    resumeId: 123,
  };
  const applicationId = 1;

  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // Mock job exists check
      pool.query.mockResolvedValueOnce({ rows: [1], rowCount: 1 });
      // Mock resume exists check
      pool.query.mockResolvedValueOnce({ rows: [1], rowCount: 1 });
      // Mock insert application
      pool.query.mockResolvedValueOnce({ rows: [{ id: applicationId }], rowCount: 1 });
      res = await request(app).post(`/api/jobs/${jobId}/applications`).send(applicationData);
    });

    // tests
    it('should return 201', async () => {
      expect(res.status).toBe(201);
    });

    it('should return the application id', async () => {
      expect(res.body.applicationId).toBe(applicationId);
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if job id is not a number', async () => {
      const res = await request(app).post(`/api/jobs/abc/applications`).send(applicationData);
      expect(res.status).toBe(400);
    });

    it('should return 400 if job id is not an integer', async () => {
      const res = await request(app).post(`/api/jobs/1.23/applications`).send(applicationData);
      expect(res.status).toBe(400);
    });

    it('should return 400 if missing body', async () => {
      const res = await request(app).post(`/api/jobs/${jobId}/applications`);
      expect(res.status).toBe(400);
    });

    describe('Missing required fields', () => {
      it('should return 422 if missing applicant name', async () => {
        // eslint-disable-next-line no-unused-vars
        const { applicantName, ...badData } = applicationData;
        // send with missing name
        const res = await request(app).post(`/api/jobs/${jobId}/applications`).send(badData);
        expect(res.status).toBe(422);
      });
      it('should return 422 if missing applicant email', async () => {
        // eslint-disable-next-line no-unused-vars
        const { applicantEmail, ...badData } = applicationData;
        // send with missing email
        const res = await request(app).post(`/api/jobs/${jobId}/applications`).send(badData);
        expect(res.status).toBe(422);
      });
      it('should return 422 is missing resume id', async () => {
        // eslint-disable-next-line no-unused-vars
        const { resumeId, ...badData } = applicationData;
        // send with missing resume id
        const res = await request(app).post(`/api/jobs/${jobId}/applications`).send(badData);
        expect(res.status).toBe(422);
      });
    });

    it('should return 422 if incorrect data type(s) in body', async () => {
      const badData = { ...applicationData, resumeId: 'abc' };
      const res = await request(app).post(`/api/jobs/${jobId}/applications`).send(badData);
      expect(res.status).toBe(422);
    });
  });

  describe('Not found', () => {
    it('should return 404 if job is not found', async () => {
      // Mock job not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await request(app).post(`/api/jobs/999/applications`).send(applicationData);
      expect(res.status).toBe(404);
    });

    it('should return 404 if resume not found', async () => {
      // Mock job exists check
      pool.query.mockResolvedValueOnce({ rows: [1], rowCount: 1 });
      // Mock resume not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await request(app).post(`/api/jobs/${jobId}/applications`).send(applicationData);
      expect(res.status).toBe(404);
    });
  });

  describe('Internal errors', () => {
    it('should return 500 if first db query fails (job check)', async () => {
      // mock db failure
      pool.query.mockRejectedValue(new Error());
      const res = await request(app).post(`/api/jobs/${jobId}/applications`).send(applicationData);
      expect(res.status).toBe(500);
    });

    it('should return 500 if second db query fails (resume check)', async () => {
      // Mock job exists check
      pool.query.mockResolvedValueOnce({ rows: [1], rowCount: 1 });
      // Mock db failure
      pool.query.mockRejectedValue(new Error());
      const res = await request(app).post(`/api/jobs/${jobId}/applications`).send(applicationData);
      expect(res.status).toBe(500);
    });

    it('should return 500 if third db query fails (insert)', async () => {
      // Mock job exists check
      pool.query.mockResolvedValueOnce({ rows: [1], rowCount: 1 });
      // Mock resume exists check
      pool.query.mockResolvedValueOnce({ rows: [1], rowCount: 1 });
      // Mock db failure
      pool.query.mockRejectedValue(new Error());
      const res = await request(app).post(`/api/jobs/${jobId}/applications`).send(applicationData);
      expect(res.status).toBe(500);
    });
  });
});

describe('GET /api/jobs/:id/applications', () => {
  const jobId = 1;
  const applicationsData = [
    {
      id: 1,
      applicant_name: 'John Doe',
      applicant_email: 'john.doe@example.com',
      resume_id: 123,
      job_id: jobId,
    },
    {
      id: 2,
      applicant_name: 'Jane Doe',
      applicant_email: 'jane.doe@example.com',
      resume_id: 456,
      job_id: jobId,
    },
  ];

  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // Mock job exists check
      pool.query.mockResolvedValueOnce({ rows: [1], rowCount: 1 });
      // Mock get applications
      pool.query.mockResolvedValueOnce({
        rows: applicationsData,
        rowCount: applicationsData.length,
      });

      res = await request(app)
        .get(`/api/jobs/${jobId}/applications`)
        .set('Authorization', `Bearer ${adminAccess}`);
    });

    // tests
    it('should return 200', async () => {
      expect(res.status).toBe(200);
    });

    it('should get all applications for a job', async () => {
      expect(res.body.applications).toEqual(applicationsData);
    });
  });

  describe('Authorization', () => {
    it('should return 401 if no token', async () => {
      // no token
      res = await request(app).get(`/api/jobs/${jobId}/applications`);
      expect(res.status).toBe(401);
    });

    it('should return 403 if not admin', async () => {
      res = await request(app)
        .get(`/api/jobs/${jobId}/applications`)
        .set('Authorization', `Bearer ${nonAdminAccess}`);
      expect(res.status).toBe(403);
    });

    it('should return 401 if token is expired', async () => {
      res = await request(app)
        .get(`/api/jobs/${jobId}/applications`)
        .set('Authorization', `Bearer ${expiredAccess}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if job id is not a number', async () => {
      const res = await request(app)
        .get(`/api/jobs/abc/applications`)
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 if job id is not an integer', async () => {
      const res = await request(app)
        .get(`/api/jobs/1.23/applications`)
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Not found', () => {
    it('should return 404 if job is not found', async () => {
      // Mock job not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await request(app)
        .get(`/api/jobs/999/applications`)
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(404);
    });
  });

  it('should return 500 if job query fails', async () => {
    // mock db failure
    pool.query.mockRejectedValue(new Error());
    const res = await request(app)
      .get(`/api/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${adminAccess}`);
    expect(res.status).toBe(500);
  });

  it('should return 500 if applications query fails', async () => {
    // Mock job exists check
    pool.query.mockResolvedValueOnce({ rows: [1], rowCount: 1 });
    // Mock db failure
    pool.query.mockRejectedValue(new Error());
    const res = await request(app)
      .get(`/api/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${adminAccess}`);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/applications/:id', () => {
  const applicationId = 1;
  const applicationData = {
    id: applicationId,
    applicant_name: 'John Doe',
    applicant_email: 'john.doe@example.com',
    resume_id: 123,
    job_id: 1,
  };

  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // mock db query
      pool.query.mockResolvedValueOnce({ rows: [applicationData], rowCount: 1 });
      res = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${adminAccess}`);
    });

    // tests
    it('should return 200', async () => {
      expect(res.status).toBe(200);
    });

    it('should get the application', async () => {
      expect(res.body.application).toEqual(applicationData);
    });
  });

  describe('Authorization', () => {
    it('should return 401 if no token', async () => {
      // no token
      res = await request(app).get(`/api/applications/${applicationId}`);
      expect(res.status).toBe(401);
    });

    it('should return 403 if not admin', async () => {
      res = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${nonAdminAccess}`);
      expect(res.status).toBe(403);
    });

    it('should return 401 if token is expired', async () => {
      res = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${expiredAccess}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if id is not a number', async () => {
      const res = await request(app)
        .get('/api/applications/abc')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 if id is not an integer', async () => {
      const res = await request(app)
        .get('/api/applications/1.23')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Not found', () => {
    it('should return 404 if application is not found', async () => {
      // mock not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await request(app)
        .get('/api/applications/999')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Internal error', () => {
    it('should return 500 if db failure', async () => {
      // mock db failure
      pool.query.mockRejectedValue(new Error());
      const res = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(500);
    });
  });
});

describe('DELETE /api/applications/:id', () => {
  const applicationId = 1;

  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // mock db delete
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      res = await request(app)
        .delete(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${adminAccess}`);
    });

    // tests
    it('should return 204', async () => {
      expect(res.status).toBe(204);
    });

    it('should delete the application', async () => {
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM applications/i), [
        applicationId,
      ]);
    });
  });

  describe('Authorization', () => {
    it('should return 401 if no token', async () => {
      // no token
      res = await request(app).delete(`/api/applications/${applicationId}`);
      expect(res.status).toBe(401);
    });

    it('should return 403 if not admin', async () => {
      res = await request(app)
        .delete(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${nonAdminAccess}`);
      expect(res.status).toBe(403);
    });

    it('should return 401 if token is expired', async () => {
      res = await request(app)
        .delete(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${expiredAccess}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if id is not a number', async () => {
      const res = await request(app)
        .delete('/api/applications/abc')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 if id is not an integer', async () => {
      const res = await request(app)
        .delete('/api/applications/1.23')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Not found', () => {
    it('should return 404 if application is not found', async () => {
      // mock not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await request(app)
        .delete('/api/applications/999')
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Internal error', () => {
    it('should return 500 if db failure', async () => {
      // mock db failure
      pool.query.mockRejectedValue(new Error());
      const res = await request(app)
        .delete(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${adminAccess}`);
      expect(res.status).toBe(500);
    });
  });
});
