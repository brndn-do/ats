// server.js

import express from 'express';
import queryWithRetry from './db.js';

const app = express();
app.use(express.json());

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
    if (!("title" in body && "description" in body && "adminId" in body)) {
      console.log("Missing required fields");
      return res.status(422).json({ error: "Missing required fields" });
    }
    if (
      typeof body.title != "string" ||
      typeof body.description != "string" ||
      typeof body.adminId != "number"
    ) {
      console.log("Incorrect data type(s) in body");
      return res.status(422).json({ error: "Incorrect data type(s) in body" });
    }
    const query = `
      INSERT INTO jobs (title, description, admin_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const params = [body.title, body.description, body.adminId];
    const result = await queryWithRetry(query, params);
    if (result.rowCount !== 1) {
      console.log("Failed to insert job");
      return res.status(500).json({ error: "Internal server error" });
    }
    console.log("Job posted");
    return res.status(201).json({ message: "Job posted", data: result.rows[0] });
  } catch (err) {
    console.error("Error posting job:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/:id
app.get("/api/jobs/:id", async (req, res) => {
  console.log("Received GET request /api/jobs/:id");
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      console.log("Invalid job ID");
      return res.status(400).json({ error: "Invalid job ID"});
    }
    const query = `
      SELECT * FROM jobs
      WHERE id = $1;
    `;
    const params = [jobId];
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
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      console.log("Invalid job ID");
      return res.status(400).json({ error: "Invalid job ID"});
    }
    const query = `
      DELETE FROM jobs WHERE id = $1
      RETURNING id, title, description, admin_id, created_at
    `;
    const params = [jobId];
    const result = await queryWithRetry(query, params);
    if (result.rowCount === 0) {
      console.log("Job not found");
      return res.status(404).json({ error: "Job not found" });
    }
    console.log("Deleted job");
    return res.json({ message: "Deleted job", data: result.rows[0] })
  } catch (err) {
    console.error("Error deleting job:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//
// TODO: add auth
//

// GET /api/jobs/:id/applications
app.get("/api/jobs/:id/applications", async (req, res) => {
  console.log("Received GET request /api/jobs/:id/applications");
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      console.log("Invalid job ID");
      return res.status(400).json({ error: "Invalid job ID"});
    }
    const query = `
      SELECT * FROM applications
      WHERE job_id = $1
    `;
    const params = [jobId];
    const result = await queryWithRetry(query, params);
    console.log(`Retrived applications for job ${jobId}`);
    return res.json({ message: `Retrived applications for job ${jobId}`, data: result.rows});
  } catch (err) {
    console.error("Error fetching applications:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/applications
app.post("/api/jobs/:id/applications", async (req, res) => {
  console.log("Received POST request /api/jobs/:id/applications");
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      console.log("Invalid Job ID");
      return res.status(400).json({ error: "Invalid Job ID" });
    }
    const jobExists = await queryWithRetry("SELECT 1 FROM jobs WHERE id = $1", [jobId]);
    if (jobExists.rowCount === 0) {
      console.log("Job not found");
      return res.status(404).json({ error: "job not found" });
    }
    const body = req.body;
    if (!("applicantName" in body && "applicantEmail" in body && "resumeId" in body)) {
      console.log("Missing required fields");
      return res.status(422).json({ error: "Missing required fields" });
    }
    if (
      typeof body.applicantName != "string" ||
      typeof body.applicantEmail != "string" ||
      typeof body.resumeId != "number"
    ) {
      console.log("Incorrect data type(s) in body");
      return res.status(422).json({ error: "Incorrect data type(s) in body" });
    }
    const resumeExists = await queryWithRetry("SELECT 1 FROM resumes WHERE id = $1", [body.resumeId]);
    if (resumeExists.rowCount === 0) {
      console.log("Resume not found");
      return res.status(404).json({ error: "Resume not found "});
    }
    const query = `
      INSERT INTO applications
      (applicant_name, applicant_email, resume_id, job_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const params = [body.applicantName, body.applicantEmail, body.resumeId, jobId];
    const result = await queryWithRetry(query, params);
    if (result.rowCount !== 1) {
      console.log("Failed to insert application");
      return res.status(500).json({ error: "Internal server error" });
    }
    console.log("Application posted");
    return res.status(201).json({ message: "Application posted", data: result.rows[0] });
  } catch (err) {
    console.error("Error posting application:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/resumes
app.post("/api/resumes", async (req, res) => {
  console.log("Receive POST request /api/resumes");
  try {
    console.log("pass");
  } catch (err) {
    console.error("Error posting application:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});