import logger from '../utils/logger.js';
import pkg from 'pg';

const { Pool } = pkg;

const poolConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
};

switch (process.env.NODE_ENV) {
  case 'dev':
    logger.info('POSTGRES: connecting to dev DB');
    poolConfig.database = process.env.DEV_DB_NAME;
    break;
  case 'test':
    logger.info('POSTGRES: connecting to test DB');
    poolConfig.database = process.env.TEST_DB_NAME;
    break;
  default:
    logger.info('POSTGRES: connecting to AWS DB');
    poolConfig.database = process.env.DB_NAME;
    // Only add SSL configuration when NOT in the dev/test environment
    // Local Docker Postgres does not use SSL, but cloud services do
    poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

const DELAY = process.env.NODE_ENV === 'test' ? 10 : 1000; // shorter delay for testing

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
