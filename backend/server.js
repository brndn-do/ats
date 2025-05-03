const express = require("express");
const pool = require("./db");
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
    } catch (err) {
      if (attempt === retries - 1) {
        throw err;
      }
      console.log(`Retrying... Attempt ${attempt + 1} of ${retries}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

app.get("/", (req, res) => {
  res.send("ATS Backend");
});

// /api/jobs GET
app.get("/api/jobs", async (req, res) => {
  console.log("GET request /api/jobs");
  try {
    const query = "SELECT * FROM jobs;";
    const result = await queryWithRetry(query);
    const jobs = result.rows;
    return res.json(jobs);
  } catch (err) {
    console.error("Error fetching jobs:", err);
    return res.status(500).json({ message: "Error fetching jobs" });
  }
});

// /api/jobs POST
app.post("/api/jobs", async (req, res) => {
  console.log("POST request /api/jobs");
  try {
    body = req.body;
    if (!("title" in body && "description" in body && "admin_id" in body))
      return res.status(422).json({ error: "Missing required fields" });
    if (
      typeof body.title != "string" ||
      typeof body.description != "string" ||
      typeof body.admin_id != "number"
    ) {
      return res.status(422).json({ error: "Incorrect data type(s) in body" });
    }
    const query =
      "INSERT INTO jobs (title, description, admin_id) VALUES ($1, $2, $3) RETURNING id";
    const values = [body.title, body.description, body.admin_id];
    const result = await queryWithRetry(query, values);
    if (result.rowCount === 1) {
      console.log("Insert successful");
      return res
        .status(201)
        .json({ message: "Job created!", job_id: result.rows[0].id });
    }
    return res.status(500).json({ message: "Failed to insert job" });
  } catch (err) {
    console.error("Error posting job:", err);
    return res.status(500).json({ message: "Error posting job" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
