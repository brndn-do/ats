// db.js

import dotenv from 'dotenv';
dotenv.config();

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false // optional, depending on your RDS setup
  }
});

// simple query function with retries
async function queryWithRetry(query, params = [], retries = 3, delay = 1000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Querying... attempt ${attempt + 1} of ${retries}`);
      const result = await pool.query(query, params);
      console.log("Query succeeded!");
      return result;
    } catch (err) {
      if (attempt === retries - 1) {
        throw err;
      }
      console.log(`Retrying... Attempt ${attempt + 1} of ${retries}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export default queryWithRetry;