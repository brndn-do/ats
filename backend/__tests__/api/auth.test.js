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

const pool = new Pool();
beforeEach(() => {
  pool.query.mockReset();
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

describe('POST /api/auth/login', () => {
  it('should return a correct access token', async () => {
    pool.query.mockResolvedValueOnce(userQueryResult);
    const res = await request(app).post('/api/auth/login').send(cred);
    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
    expect(payload).toMatchObject(expectedPayload);
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(300);
  });
  it('should return a refresh token', async () => {
    const spy = jest.spyOn(crypto, 'randomBytes');
    pool.query.mockResolvedValueOnce(userQueryResult);
    const res = await request(app).post('/api/auth/login').send(cred);
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('should save refresh token to db', async () => {
    pool.query.mockResolvedValueOnce(userQueryResult); // SELECT
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT
    const res = await request(app).post('/api/auth/login').send(cred);
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO refresh_tokens/i), [
      expect.any(Number), // user_id
      expect.any(String), // refresh_token_hash
      expect.any(Date), // expires_at
    ]);
  });
  it('should return 400 if body is missing', async () => {
    pool.query.mockResolvedValueOnce(userQueryResult);
    const res = await request(app).post('/api/auth/login');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing body');
    expect(pool.query).not.toHaveBeenCalled();
  });
  describe('missing required fields', () => {
    it('should return 400 if missing username', async () => {
      const badCred = { password: 'abc123' };
      pool.query.mockResolvedValueOnce(userQueryResult);
      const res = await request(app).post('/api/auth/login').send(badCred);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields');
      expect(pool.query).not.toHaveBeenCalled();
    });
    it('should return 400 if missing password', async () => {
      const badCred = { username: 'admin' };
      pool.query.mockResolvedValueOnce(userQueryResult);
      const res = await request(app).post('/api/auth/login').send(badCred);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields');
      expect(pool.query).not.toHaveBeenCalled();
    });
  });
  describe('incorrect data type(s) in body', () => {
    it('should return 422 if username is not string', async () => {
      const badCred = { username: 123, password: 'abc123' };
      pool.query.mockResolvedValueOnce(userQueryResult);
      const res = await request(app).post('/api/auth/login').send(badCred);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Incorrect data type(s) in body');
      expect(pool.query).not.toHaveBeenCalled();
    });
    it('should return 422 if password is not string', async () => {
      const badCred = { username: 'admin', password: 123 };
      pool.query.mockResolvedValueOnce(userQueryResult);
      const res = await request(app).post('/api/auth/login').send(badCred);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Incorrect data type(s) in body');
      expect(pool.query).not.toHaveBeenCalled();
    });
  });
  it("should return 401 if user doesn't exist", async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).post('/api/auth/login').send(cred);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });
  it('should return 401 if password is incorrect', async () => {
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
    expect(res.body.error).toBe('Invalid credentials');
  });
  it('should return 500 if db failure', async () => {
    pool.query.mockRejectedValue(new Error());
    const res = await request(app).post('/api/auth/login').send(cred);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

describe('POST /api/auth/logout', () => {
  const { refreshToken, refreshTokenHash } = createTokens(1, 'admin', true);

  it('should delete the refresh token in the database', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
    const res = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(res.status).toBe(204);
    expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM refresh_tokens/i), [
      refreshTokenHash,
    ]);
  });

  it('should return 400 if body is missing', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing body');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should return 400 if missing refresh token', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing refreshToken');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should return 422 if refresh token is wrong data type', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
    const res = await request(app).post('/api/auth/logout').send({ refreshToken: 123 });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Incorrect data type in body');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("should return 204 if refresh token doesn't exist in database", async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(res.status).toBe(204);
  });

  it('should return 500 if db failure', async () => {
    pool.query.mockRejectedValue(new Error());
    const res = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

describe('POST /api/auth/refresh', () => {
  const { refreshToken, refreshTokenHash } = createTokens(1, 'admin', true);

  it('should return a new correct access token', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 }); // SELECT ... FROM refresh_tokens
    pool.query.mockResolvedValueOnce(userQueryResult); // SELECT ... FROM users
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
    expect(payload).toMatchObject(expectedPayload);
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(300);
  });
  it('should return a new refresh token', async () => {
    const spy = jest.spyOn(crypto, 'randomBytes');
    pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 }); // SELECT ... FROM refresh_tokens
    pool.query.mockResolvedValueOnce(userQueryResult); // SELECT ... FROM users
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    const newRefreshToken = res.body.refreshToken;
    expect(newRefreshToken).toEqual(expect.any(String));
    expect(newRefreshToken).not.toBe(refreshToken);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('should update db with new refresh token', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 }); // SELECT ... FROM refresh_tokens
    pool.query.mockResolvedValueOnce(userQueryResult); // SELECT ... FROM users
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    const newRefreshToken = res.body.refreshToken;
    const newRefreshTokenHash = hash(newRefreshToken);
    expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/UPDATE refresh_tokens/i), [
      newRefreshTokenHash,
      expect.any(Date),
      refreshTokenHash,
    ]);
  });
  it('should return 400 if body is missing', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing body');
    expect(pool.query).not.toHaveBeenCalled();
  });
  it('should return 400 if missing refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing refresh token');
    expect(pool.query).not.toHaveBeenCalled();
  });
  it('should return 422 if refresh token is wrong data type', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 123 });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Invalid data type in body');
    expect(pool.query).not.toHaveBeenCalled();
  });
  it("should return 401 if refresh token doesn't exist in database", async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // refreshTokenQuery
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid refresh token');
  });
  it('should return 401 if refresh token is expired', async () => {
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
    expect(res.body.error).toBe('Invalid refresh token');
  });
  it('should return 500 if db failure', async () => {
    pool.query.mockRejectedValue(new Error());
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});
