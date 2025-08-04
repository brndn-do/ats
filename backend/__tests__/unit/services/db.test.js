import queryWithRetry from '../../../src/services/db.js';

import { Pool } from 'pg';

// Mocks the `pg` module. `new Pool()` will always return the same singleton
// mock object, allowing tests to configure its behavior for database calls.
jest.mock('pg', () => {
  const mPool = { query: jest.fn() };

  return { Pool: jest.fn(() => mPool) };
});

const errMsg = 'DB connection error';

describe('queryWithRetry', () => {
  const id = 1;
  const query = `
    SELECT * FROM jobs
    WHERE id = $1;
  `;
  const params = [id];
  const pool = new Pool();
  const mockResolvedValue = {
    rows: [],
    rowCount: 1,
  };
  beforeEach(() => {
    pool.query.mockClear();
  });

  it('should succeed on the first attempt', async () => {
    pool.query.mockResolvedValueOnce(mockResolvedValue);
    const dbResult = await queryWithRetry(query, params);
    expect(dbResult).toBe(mockResolvedValue);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('should succeed after one retry if the first attempt fails', async () => {
    pool.query.mockRejectedValueOnce(new Error(errMsg));
    pool.query.mockResolvedValueOnce(mockResolvedValue);
    const dbResult = await queryWithRetry(query, params);
    expect(dbResult).toBe(mockResolvedValue);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('should throw an error after all retry attempts fail', async () => {
    pool.query.mockRejectedValue(new Error(errMsg));
    await expect(queryWithRetry(query, params)).rejects.toThrow();
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  it('should correctly pass query and parameters to the database client', async () => {
    pool.query.mockResolvedValueOnce(mockResolvedValue);
    await queryWithRetry(query, params);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(query, params);
  });
});
