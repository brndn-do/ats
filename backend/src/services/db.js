import dotenv from 'dotenv';
import logger from '../utils/logger';
import pkg from 'pg';

const { Pool } = pkg;
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

const DELAY = 10;

// Given a SQL query and parameters, executes the query with retries
// Input: query, params, optional retry count, optional delay
// Returns the result object returned by .query(...)
async function queryWithRetry(query, params = [], retries = 3, delay = DELAY) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await pool.query(query, params);

      return result;
    } catch (err) {
      logger.error(err);
      if (attempt === retries - 1) {
        break;
      }
      logger.info(`Retrying... attempt ${attempt + 2} of ${retries}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Query failed after all retries');
}

export default queryWithRetry;
export { pool };
