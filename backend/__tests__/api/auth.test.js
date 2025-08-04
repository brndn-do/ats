import request from 'supertest';
import app from '../../src/app.js';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import hash from '../../src/utils/hash.js';
import createTokens from '../../src/utils/createTokens.js';

// Mocks the `pg` module. `new Pool()` will always return the same singleton
// mock object, allowing tests to configure its behavior for database calls.
jest.mock('pg', () => {
  const mPool = { query: jest.fn() };

  return { Pool: jest.fn(() => mPool) };
});

// example user's credentials for testing
const cred = {
  username: 'admin',
  password: 'abc123',
};

// example user's info in the database
const userQueryResult = {
  rows: [
    {
      id: 1,
      username: 'admin',
      pwd_hash: bcrypt.hashSync(cred.password, 12), // hashed "abc123"
      is_admin: true,
    },
  ],
  rowCount: 1,
};

// the expected payload of the access token
const expectedPayload = {
  sub: 1,
  name: 'admin',
  isAdmin: true,
};

const pool = new Pool();
beforeEach(() => {
  pool.query.mockReset();
});

describe('POST /api/auth/login', () => {
  describe('Good request', () => {
    // see if crypto.randomBytes was used to generate refresh token
    const spy = jest.spyOn(crypto, 'randomBytes');
    let res;
    beforeEach(async () => {
      spy.mockClear();
      // configure mock for db
      pool.query.mockResolvedValueOnce(userQueryResult); // SELECT
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT

      // send a good request
      res = await request(app).post('/api/auth/login').send(cred);
    });

    // tests
    it('should return 200', async () => {
      expect(res.status).toBe(200);
    });

    it('should return a correct access token', async () => {
      // verify the payload
      const payload = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
      expect(payload).toMatchObject(expectedPayload);
      // check that expiration is later than issue
      expect(payload.exp - payload.iat).toBeGreaterThan(0);
    });

    it('should return a good refresh token', async () => {
      // expect refresh token to be a string
      expect(res.body.refreshToken).toEqual(expect.any(String));
      // expect crypto.randomBytes() was used to generate
      expect(spy).toHaveBeenCalled();
    });

    it('should save refresh token to db', async () => {
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO refresh_tokens/i),
        [
          expect.any(Number), // user_id
          expect.any(String), // refresh_token_hash
          expect.any(Date), // expires_at
        ]
      );
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if body is missing', async () => {
      const res = await request(app).post('/api/auth/login');
      expect(res.status).toBe(400);
    });

    describe('missing required fields', () => {
      it('should return 400 if missing username', async () => {
        const badCred = { password: 'abc123' };
        const res = await request(app).post('/api/auth/login').send(badCred);
        expect(res.status).toBe(400);
      });

      it('should return 400 if missing password', async () => {
        const badCred = { username: 'admin' };
        const res = await request(app).post('/api/auth/login').send(badCred);
        expect(res.status).toBe(400);
      });
    });

    describe('incorrect data type(s) in body', () => {
      it('should return 422 if username is not string', async () => {
        const badCred = { username: 123, password: 'abc123' };
        const res = await request(app).post('/api/auth/login').send(badCred);
        expect(res.status).toBe(422);
      });

      it('should return 422 if password is not string', async () => {
        const badCred = { username: 'admin', password: 123 };
        const res = await request(app).post('/api/auth/login').send(badCred);
        expect(res.status).toBe(422);
      });
    });
  });

  describe('Login errors', () => {
    // should return 401 for all cases for security
    it("should return 401 if user doesn't exist", async () => {
      // mock user not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await request(app).post('/api/auth/login').send(cred);
      expect(res.status).toBe(401);
    });

    it('should return 401 if password is incorrect', async () => {
      // mock different pwd_hash
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            username: 'admin',
            pwd_hash: bcrypt.hashSync('def456', 12), // hashed "def456"
            is_admin: true,
          },
        ],
        rowCount: 1,
      });
      const res = await request(app).post('/api/auth/login').send(cred);
      expect(res.status).toBe(401);
    });
  });

  describe('Internal error', () => {
    it('should return 500 if db failure', async () => {
      pool.query.mockRejectedValue(new Error());
      const res = await request(app).post('/api/auth/login').send(cred);
      expect(res.status).toBe(500);
    });
  });
});

describe('POST /api/auth/logout', () => {
  const { refreshToken, refreshTokenHash } = createTokens(1, 'admin', true);

  describe('Good request', () => {
    let res;
    beforeEach(async () => {
      // configure mock for db
      pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
      // send a good request
      res = await request(app).post('/api/auth/logout').send({ refreshToken });
    });

    // tests
    it('should return 204', async () => {
      expect(res.status).toBe(204);
    });

    it('should delete the refresh token in the database', async () => {
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM refresh_tokens/i),
        [refreshTokenHash]
      );
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if body is missing', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(400);
    });

    it('should return 400 if missing refresh token', async () => {
      const res = await request(app).post('/api/auth/logout').send({});
      expect(res.status).toBe(400);
    });

    it('should return 422 if refresh token is wrong data type', async () => {
      const res = await request(app).post('/api/auth/logout').send({ refreshToken: 123 });
      expect(res.status).toBe(422);
    });
  });

  describe('Not found', () => {
    it("should return 204 if refresh token doesn't exist in database", async () => {
      // mock refresh token not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await request(app).post('/api/auth/logout').send({ refreshToken });
      expect(res.status).toBe(204);
    });
  });

  describe('Internal error', () => {
    it('should return 500 if db failure', async () => {
      pool.query.mockRejectedValue(new Error());
      const res = await request(app).post('/api/auth/logout').send({ refreshToken });
      expect(res.status).toBe(500);
    });
  });
});

describe('POST /api/auth/refresh', () => {
  const { refreshToken, refreshTokenHash } = createTokens(1, 'admin', true);

  describe('Good request', () => {
    const spy = jest.spyOn(crypto, 'randomBytes');
    let res;
    beforeEach(async () => {
      spy.mockClear();
      // configure mock for db
      pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 }); // SELECT ... FROM refresh_tokens
      pool.query.mockResolvedValueOnce(userQueryResult); // SELECT ... FROM users
      res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    });

    // tests
    it('should return 200', async () => {
      expect(res.status).toBe(200);
    });

    it('should return a new correct access token', async () => {
      // verify payload
      const payload = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
      expect(payload).toMatchObject(expectedPayload);
      // check expiration is later than issue
      expect(payload.exp - payload.iat).toBeGreaterThan(0);
    });

    it('should return a new refresh token', async () => {
      const newRefreshToken = res.body.refreshToken;
      // expect new refresh token to be string
      expect(newRefreshToken).toEqual(expect.any(String));
      // expect new refresh token is different than previous
      expect(newRefreshToken).not.toBe(refreshToken);
      // expect crypto.randomBytes was used
      expect(spy).toHaveBeenCalled();
    });

    it('should update db with new refresh token', async () => {
      const newRefreshToken = res.body.refreshToken;
      const newRefreshTokenHash = hash(newRefreshToken);
      // expect hash was updated in DB
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/UPDATE refresh_tokens/i), [
        newRefreshTokenHash,
        expect.any(Date),
        refreshTokenHash,
      ]);
    });
  });

  describe('Validation tests', () => {
    it('should return 400 if body is missing', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(400);
    });
    it('should return 400 if missing refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(400);
    });
    it('should return 422 if refresh token is wrong data type', async () => {
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 123 });
      expect(res.status).toBe(422);
    });
  });

  describe('Not found or expired', () => {
    it("should return 401 if refresh token doesn't exist in database", async () => {
      // mock refresh token not found
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(401);
    });
    it('should return 401 if refresh token is expired', async () => {
      // mock expired refresh token
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: 1,
            expires_at: new Date(Date.now() - 1000), // expired a second ago
          },
        ],
        rowCount: 1,
      });
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(401);
    });
  });

  describe('Internal error', () => {
    it('should return 500 if db failure', async () => {
      pool.query.mockRejectedValue(new Error());
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(500);
    });
  });
});
