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

/**
 * Executes a SQL query, retrying on failure.
 *
 * @param {string} query - The SQL query to execute.
 * @param {list} [params=[]] - The parameters to use.
 * @param {number} [attempts=3] - The maximum number of attempts.
 * @param {number} [delay=DELAY] - The delay in milliseconds between attempts.
 * @returns {Promise<*>} the result of the query
 * @throws Will throw an error if all attempts fail.
 */
async function queryWithRetry(query, params = [], attempts = 3, delay = DELAY) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await pool.query(query, params);

      return result;
    } catch (err) {
      logger.error(err);
      if (attempt === attempts - 1) {
        break;
      }
      logger.info(`Retrying... attempt ${attempt + 2} of ${attempts}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Query failed after all attempts');
}

export default queryWithRetry;
export { pool };
