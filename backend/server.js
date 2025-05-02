const express = require("express");
const pool = require('./db')

const app = express();

app.use(express.json());

// simple query function with retries
async function queryWithRetry(query, params = [], retries = 3, delay = 1000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Querying... attempt ${attempt + 1} of ${retries}`);
      const result = await pool.query(query, params);
      console.log("Query succeeded!");
      return result;
    } catch(err) {
      if (attempt === retries - 1) {
        throw err;
      }
      console.log(`Retrying... Attempt ${attempt + 1} of ${retries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

app.get("/", (req, res) => {
  res.send("ATS Backend");
});

app.get("/api/jobs", async (req, res) => {
  console.log('GET request api/jobs')
  try {
    const query = "SELECT * FROM jobs;";
    const response = await queryWithRetry(query);
    const jobs = response.rows;
    res.json(jobs);
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ message: "Error fetching jobs" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
