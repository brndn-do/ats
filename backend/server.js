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

// GET /
app.get("/", (req, res) => {
  console.log("Received GET request /");
  res.send("ATS Backend");
});

// GET /api/jobs
app.get("/api/jobs", async (req, res) => {
  console.log("Received GET request /api/jobs");
  try {
    const query = "SELECT * FROM jobs;";
    const result = await queryWithRetry(query);
    const jobs = result.rows;
    console.log("Jobs retrieved")
    return res.json({ message: "Jobs retrieved", data: jobs });
  } catch (err) {
    console.error("Error fetching jobs:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//
// TODO: add authentication to this route
//

// POST /api/jobs
app.post("/api/jobs", async (req, res) => {
  console.log("Received POST request /api/jobs");
  try {
    const body = req.body;
    if (!("title" in body && "description" in body && "admin_id" in body)) {
      console.log("Missing required fields");
      return res.status(422).json({ error: "Missing required fields" });
    }
    if (
      typeof body.title != "string" ||
      typeof body.description != "string" ||
      typeof body.admin_id != "number"
    ) {
      console.log("Incorrect data type(s) in body");
      return res.status(422).json({ error: "Incorrect data type(s) in body" });
    }
    const query = `
      INSERT INTO jobs (title, description, admin_id)
      VALUES ($1, $2, $3)
      RETURNING id, title, description, admin_id, created_at
    `;
    const params = [body.title, body.description, body.admin_id];
    const result = await queryWithRetry(query, params);
    if (result.rowCount !== 1) {
      console.log("Failed to insert job");
      return res.status(500).json({ error: "Internal server error" });
    }
    console.log("Job created");
    return res.status(201).json({ message: "Job created", data: result.rows[0] });
  } catch (err) {
    console.error("Error posting job:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/:id
app.get("/api/jobs/:id", async (req, res) => {
  console.log("Received GET request /api/jobs/:id");
  try {
    const job_id = parseInt(req.params.id);
    if (isNaN(job_id)) {
      console.log("Invalid job ID");
      return res.status(400).json({ error: "Invalid job ID"});
    }
    const query = `
      SELECT * FROM jobs
      WHERE id = $1;
    `;
    const params = [job_id];
    const result = await queryWithRetry(query, params);
    if (result.rowCount === 0) {
      console.log("Job not found");
      return res.status(404).json({ error: "Job not found" });
    }
    console.log("Job retrieved");
    return res.json({ message: "Job retrieved", data: result.rows[0] });
  } catch (err) {
    console.error("Error fetching job");
    return res.status(500).json({ error: "Internal server error" });
  }
});

//
// TODO: add authentication to this route
//

// DELETE /api/jobs/:id
app.delete("/api/jobs/:id", async (req, res) => {
  console.log("Received DELETE request /api/jobs/:id");
  try {
    const job_id = parseInt(req.params.id);
    if (isNaN(job_id)) {
      console.log("Invalid job ID");
      return res.status(400).json({ error: "Invalid job ID"});
    }
    const query = `
      DELETE FROM jobs WHERE id = $1
      RETURNING id, title, description, admin_id, created_at
    `;
    const params = [job_id];
    const result = await queryWithRetry(query, params);
    if (result.rowCount === 0) {
      console.log("Job not found");
      return res.status(404).json({ error: "Job not found" });
    }
    console.log("Deleted job");
    return res.status(200).json({ message: "Deleted job", data: result.rows[0] })
  } catch (err) {
    console.error("Error deleting job:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
