import queryWithRetry from '../../../src/services/db.js';

import { Pool } from 'pg';

// Mocks the `pg` module. `new Pool()` will always return the same singleton
// mock object, allowing tests to configure its behavior for database calls.
jest.mock('pg', () => {
  const mPool = { query: jest.fn() };

  return { Pool: jest.fn(() => mPool) };
});

describe('queryWithRetry', () => {
  const id = 1;
  const query = `
    SELECT * FROM jobs
    WHERE id = $1;
  `;
  const params = [id];
  const pool = new Pool();
  const queryResult = { rows: [], rowCount: 1 };
  beforeEach(() => {
    pool.query.mockClear();
  });

  it('should succeed on the first attempt', async () => {
    pool.query.mockResolvedValueOnce(queryResult);
    const dbResult = await queryWithRetry(query, params);
    expect(dbResult).toBe(queryResult);
  });

  it('should succeed after one retry if the first attempt fails', async () => {
    pool.query.mockRejectedValueOnce(new Error());
    pool.query.mockResolvedValueOnce(queryResult);
    const dbResult = await queryWithRetry(query, params);
    expect(dbResult).toBe(queryResult);
  });

  it('should throw an error after all retry attempts fail', async () => {
    pool.query.mockRejectedValue(new Error());
    await expect(queryWithRetry(query, params)).rejects.toThrow();
  });

  it('should correctly pass query and parameters to the database client', async () => {
    pool.query.mockResolvedValueOnce(queryResult);
    await queryWithRetry(query, params);
    expect(pool.query).toHaveBeenCalledWith(query, params);
  });
});
