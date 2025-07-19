// app.js

import express from "express";
import multer from "multer";
import queryWithRetry from "./db.js";
import { uploadResume, downloadResume, deleteResume } from "./s3.js";

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

//
//
// TODO: add authentication to routes requiring admin authentication
//

// GET /
app.get("/", (req, res) => {
  console.log("Received GET request /");
  res.json({ status: "ok", message: "ATS API" });
});

// POST /api/resumes
app.post("/api/resumes", upload.single("resume"), async (req, res) => {
  console.log("Received POST request /api/resumes");
  try {
    if (!req.file) {
      console.log("Missing file");
      return res.status(400).json({ error: "Missing file" });
    }
    if (req.file.mimetype !== "application/pdf") {
      console.log("Received non-PDF file");
      return res.status(400).json({ error: "Received non-PDF file" });
    }
    // upload to S3
    const pdfBuffer = req.file.buffer;
    const s3Result = await uploadResume(pdfBuffer);
    // add to database
    const query = `
      INSERT INTO resumes
      (original_filename, object_key)
      VALUES ($1, $2)
      RETURNING *
    `;
    const params = [req.file.originalname, s3Result.objectKey];
    const dbResult = await queryWithRetry(query, params);
    if (dbResult.rowCount !== 1) {
      console.log("Failed to insert resume");
      await deleteResume(s3Result.objectKey);
      return res.status(500).json({ error: "Internal server error" });
    }
    console.log("Resume posted");
    return res
      .status(201)
      .json({ message: "Resume posted", data: dbResult.rows[0] });
  } catch (err) {
    console.error("Error posting resume:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/resumes/:id
app.get("/api/resumes/:id", async (req, res) => {
  console.log("Received GET request /api/resumes/:id");
  try {
    const resumeId = parseInt(req.params.id);
    if (isNaN(resumeId)) {
      console.log("Invalid resume ID");
      return res.status(400).json({ error: "Invalid resume ID" });
    }
    // query DB
    const query = `
      SELECT original_filename, object_key FROM resumes
      WHERE id = $1;
    `;
    const params = [resumeId];
    const dbResult = await queryWithRetry(query, params);
    if (dbResult.rowCount === 0) {
      console.log("Resume not found");
      return res.status(404).json({ error: "Resume not found" });
    }
    // download from S3
    const objectKey = dbResult.rows[0].object_key;
    const s3Result = await downloadResume(objectKey);
    res.setHeader("Content-Type", s3Result.ContentType || "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${dbResult.rows[0].original_filename}"`
    );
    console.log("Resume retrieved");
    return s3Result.Body.pipe(res);
  } catch (err) {
    console.error("Error fetching resume", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/resumes/:id
app.delete("/api/resumes/:id", async (req, res) => {
  console.log("Received DELETE request /api/resumes/:id");
  try {
    const resumeId = parseInt(req.params.id);
    if (isNaN(resumeId)) {
      console.log("Invalid resume ID");
      return res.status(400).json({ error: "Invalid resume ID" });
    }
    // query DB
    const query = `
      SELECT object_key from resumes
      WHERE id = $1
    `;
    const params = [resumeId];
    const dbResult = await queryWithRetry(query, params);
    if (dbResult.rowCount === 0) {
      console.log("Resume not found");
      return res.status(404).json({ error: "Resume not found" });
    }
    console.log("Retrived object key from database");
    // delete from S3
    const objectKey = dbResult.rows[0].object_key;
    await deleteResume(objectKey);
    console.log("Deleted resume from S3");
    // delete from DB
    const deleteQuery = `
      DELETE FROM resumes
      WHERE id = $1
      RETURNING *
    `;
    const dbDelete = await queryWithRetry(deleteQuery, params);
    if (dbDelete.rowCount === 0) {
      console.log("Error deleting resume");
      return res.status(500).json({ error: "Internal server error" });
    }
    console.log("Deleted resume from DB");
    console.log("Resume deleted");
    return res.status(204).send();
  } catch (err) {
    console.error("Error deleting resume", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs
app.post("/api/jobs", async (req, res) => {
  console.log("Received POST request /api/jobs");
  try {
    if (!req.body) {
      console.log("Missing body");
      return res.status(400).json({ error: "Missing body" });
    }
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
    return res
      .status(201)
      .json({ message: "Job posted", data: result.rows[0] });
  } catch (err) {
    console.error("Error posting job:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs
app.get("/api/jobs", async (req, res) => {
  console.log("Received GET request /api/jobs");
  try {
    const query = "SELECT * FROM jobs;";
    const result = await queryWithRetry(query);
    const jobs = result.rows;
    console.log("Jobs retrieved");
    return res.json({ message: "Jobs retrieved", data: jobs });
  } catch (err) {
    console.error("Error fetching jobs:", err);
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
      return res.status(400).json({ error: "Invalid job ID" });
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
    console.error("Error fetching job", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/jobs/:id
app.delete("/api/jobs/:id", async (req, res) => {
  console.log("Received DELETE request /api/jobs/:id");
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      console.log("Invalid job ID");
      return res.status(400).json({ error: "Invalid job ID" });
    }
    const query = `
      DELETE FROM jobs WHERE id = $1
      RETURNING *
    `;
    const params = [jobId];
    const result = await queryWithRetry(query, params);
    if (result.rowCount === 0) {
      console.log("Job not found");
      return res.status(404).json({ error: "Job not found" });
    }
    console.log("Deleted job");
    return res.json({ message: "Deleted job", data: result.rows[0] });
  } catch (err) {
    console.error("Error deleting job:", err);
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
    const jobExists = await queryWithRetry("SELECT 1 FROM jobs WHERE id = $1", [
      jobId,
    ]);
    if (jobExists.rowCount === 0) {
      console.log("Job not found");
      return res.status(404).json({ error: "job not found" });
    }
    if (!req.body) {
      console.log("Missing body");
      return res.status(400).json({ error: "Missing body" });
    }
    const body = req.body;
    if (
      !(
        "applicantName" in body &&
        "applicantEmail" in body &&
        "resumeId" in body
      )
    ) {
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
    const resumeExists = await queryWithRetry(
      "SELECT 1 FROM resumes WHERE id = $1",
      [body.resumeId]
    );
    if (resumeExists.rowCount === 0) {
      console.log("Resume not found");
      return res.status(404).json({ error: "Resume not found " });
    }
    const query = `
      INSERT INTO applications
      (applicant_name, applicant_email, resume_id, job_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const params = [
      body.applicantName,
      body.applicantEmail,
      body.resumeId,
      jobId,
    ];
    const result = await queryWithRetry(query, params);
    if (result.rowCount !== 1) {
      console.log("Failed to insert application");
      return res.status(500).json({ error: "Internal server error" });
    }
    console.log("Application posted");
    return res
      .status(201)
      .json({ message: "Application posted", data: result.rows[0] });
  } catch (err) {
    console.error("Error posting application:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/:id/applications
app.get("/api/jobs/:id/applications", async (req, res) => {
  console.log("Received GET request /api/jobs/:id/applications");
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      console.log("Invalid job ID");
      return res.status(400).json({ error: "Invalid job ID" });
    }
    const query = `
      SELECT * FROM applications
      WHERE job_id = $1
    `;
    const params = [jobId];
    const result = await queryWithRetry(query, params);
    console.log(`Retrived applications for job ${jobId}`);
    return res.json({
      message: `Retrived applications for job ${jobId}`,
      data: result.rows,
    });
  } catch (err) {
    console.error("Error fetching applications:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/applications/:id
app.get("/api/applications/:id", async (req, res) => {
  console.log("Received GET request /api/applications/:id");
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId)) {
      console.log("Invalid application ID");
      return res.status(400).json({ error: "Invalid application ID" });
    }
    const query = `
      SELECT * FROM applications
      WHERE id = $1;
    `;
    const params = [applicationId];
    const result = await queryWithRetry(query, params);
    if (result.rowCount === 0) {
      console.log("Application not found");
      return res.status(404).json({ error: "Application not found" });
    }
    console.log("Application retrieved");
    return res.json({ message: "Application retrieved", data: result.rows[0] });
  } catch (err) {
    console.error("Error fetching Application", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/applications/:id
app.delete("/api/applications/:id", async (req, res) => {
  console.log("Received DELETE request /api/applications/:id");
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId)) {
      console.log("Invalid application ID");
      return res.status(400).json({ error: "Invalid application ID" });
    }
    const query = `
      DELETE FROM applications WHERE id = $1
      RETURNING *;
    `;
    const params = [applicationId];
    const result = await queryWithRetry(query, params);
    if (result.rowCount === 0) {
      console.log("Application not found");
      return res.status(404).json({ error: "Application not found" });
    }
    console.log("Deleted application");
    return res.json({ message: "Deleted application", data: result.rows[0] });
  } catch (err) {
    console.error("Error deleting application:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
