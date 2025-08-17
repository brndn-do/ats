import express from 'express';
import multer from 'multer';
import queryWithRetry from './services/db.js';
import { uploadResume, downloadResume, deleteResume } from './services/s3.js';
import bcrypt from 'bcrypt';
import hash from './utils/hash.js';
import createTokens from './utils/createTokens.js';
import logger from './utils/logger.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;

    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Access token has expired ' });
    }

    return res.status(401).json({ error: 'Invalid access token ' });
  }
}

// Admin authorization middleware
function authorize(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admins only' });
  }

  return next();
}

/**
 * GET /
 * Returns a status check.
 */
app.get('/', (_req, res) => {
  res.json({ message: 'ATS API' });
});

/**
 * POST /api/auth/login
 * Issues a 5-minute access token and a 30-day refresh token.
 * Saves the refresh token hash in the database.
 * Body parameters:
 * - username: string (required)
 * - password: string (required)
 */
app.post('/api/auth/login', async (req, res, next) => {
  // input validation
  if (!req.body) {
    return res.status(400).json({ error: 'Missing body' });
  }
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const username = req.body.username;
  const password = req.body.password;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(422).json({ error: 'Incorrect data type(s) in body' });
  }
  // accept request
  try {
    // get user data
    const selectQuery = `
      SELECT (id, username, pwd_hash, is_admin)
      FROM users
      WHERE username = $1
    `;
    const selectParams = [username];
    const selectResult = await queryWithRetry(selectQuery, selectParams);

    if (selectResult.rowCount === 0) {
      // username doesn't exist
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userData = selectResult.rows[0];

    if (!(await bcrypt.compare(password, userData.pwd_hash))) {
      // wrong password
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // create access token, refresh token, and the refresh token hash
    const { accessToken, refreshToken, refreshTokenHash } = createTokens(
      userData.id,
      userData.username,
      userData.is_admin
    );

    // insert refresh token hash into DB
    const insertQuery = `
      INSERT INTO refresh_tokens (user_id, refresh_token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;
    const insertParams = [
      userData.id,
      refreshTokenHash,
      new Date(Date.now() + REFRESH_TOKEN_EXPIRY), // 30 days
    ];
    await queryWithRetry(insertQuery, insertParams);

    // return tokens
    return res.json({ accessToken, refreshToken });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/auth/logout
 * Invalidates the user's refresh token in the database
 * Body parameters:
 * - refreshToken: string (required)
 */
app.post('/api/auth/logout', async (req, res, next) => {
  // input validation
  if (!req.body) {
    return res.status(400).json({ error: 'Missing body' });
  }
  const refreshToken = req.body.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refreshToken' });
  }
  if (typeof refreshToken !== 'string') {
    return res.status(422).json({ error: 'Incorrect data type in body' });
  }
  // accept request
  try {
    // delete the hash from DB if it exists, otherwise, do nothing
    const refreshTokenHash = hash(refreshToken);
    const query = `
    DELETE FROM refresh_tokens
    WHERE refresh_token_hash = $1
    `;
    const params = [refreshTokenHash];
    await queryWithRetry(query, params);

    // no content to return
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/auth/refresh
 * Issues a new 5-minute access token and a new 30-day refresh token.
 * Updates the refresh token hash in the database to the new hash.
 * Body parameters:
 * - refreshToken: string (required)
 */
app.post('/api/auth/refresh', async (req, res, next) => {
  // input validation
  if (!req.body) {
    return res.status(400).json({ error: 'Missing body' });
  }
  const refreshToken = req.body.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }
  if (typeof req.body.refreshToken !== 'string') {
    return res.status(422).json({ error: 'Invalid data type in body' });
  }
  // accept request
  try {
    // look up refresh token hash in DB to get user ID and expiration
    const refreshTokenHash = hash(refreshToken);
    const refreshTokenQuery = `
    SELECT (user_id, expires_at)
    FROM refresh_tokens
    WHERE refresh_token_hash = $1
    `;
    const refreshTokenParams = [refreshTokenHash];
    const refreshTokenResult = await queryWithRetry(refreshTokenQuery, refreshTokenParams);

    // if no match or the token is expired:
    if (refreshTokenResult.rowCount === 0 || refreshTokenResult.rows[0].expires_at < new Date()) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userId = refreshTokenResult.rows[0].user_id;

    // look up user in DB to get user info
    const userQuery = `
    SELECT (id, username, pwd_hash, is_admin)
    FROM users
    WHERE id = $1
    `;
    const userParams = [userId];
    const userResult = await queryWithRetry(userQuery, userParams);
    const row = userResult.rows[0];

    // create access token, refresh token, and the refresh token hash
    const {
      accessToken,
      refreshToken: newRefreshToken, // rename to newRefreshToken
      refreshTokenHash: newRefreshTokenHash, // rename to newRefreshTokenHash
    } = createTokens(row.id, row.username, row.is_admin);

    // update refresh token in DB
    const updateQuery = `
      UPDATE refresh_tokens
      SET 
        refresh_token_hash = $1
        expires_at = $2
      WHERE refresh_token_hash = $3
    `;
    const updateParams = [
      newRefreshTokenHash, // new hash
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      refreshTokenHash, // old hash
    ];
    await queryWithRetry(updateQuery, updateParams);

    // return the new tokens
    return res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/resumes
 * Uploads a resume in PDF form to the object storage and adds the key to the database.
 * Returns the resume ID in the DB.
 * Expects a file in the 'file' field.
 */
app.post('/api/resumes', upload.single('resume'), async (req, res, next) => {
  // input validation
  if (!req.file) {
    return res.status(400).json({ error: 'Missing file' });
  }
  if (req.file.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'Received non-PDF file' });
  }
  // accept request
  try {
    // upload to storage
    const pdfBuffer = req.file.buffer;
    const sResult = await uploadResume(pdfBuffer);
    // add to database
    const query = `
      INSERT INTO resumes
      (original_filename, object_key)
      VALUES ($1, $2)
      RETURNING id
    `;
    const params = [req.file.originalname, sResult.objectKey];
    const dbResult = await queryWithRetry(query, params);
    const resumeId = dbResult.rows[0].id;

    // return resume ID
    return res.status(201).json({ resumeId });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/resumes/:id
 * Gets the PDF file of a resume by its ID in the DB.
 * This is a protected route and requires admin privileges.
 * URL parameter:
 * - id: Resume ID (number)
 */
app.get('/api/resumes/:id', authenticate, authorize, async (req, res, next) => {
  // input validation
  const resumeId = parseInt(req.params.id);
  if (isNaN(resumeId) || !Number.isInteger(parseFloat(req.params.id))) {
    return res.status(400).json({ error: 'Invalid resume ID' });
  }
  // accept request
  try {
    // get resume info from DB
    const query = `
      SELECT original_filename, object_key FROM resumes
      WHERE id = $1;
    `;
    const params = [resumeId];
    const dbResult = await queryWithRetry(query, params);
    if (dbResult.rowCount === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    const objectKey = dbResult.rows[0].object_key;
    const originalFilename = dbResult.rows[0].original_filename;
    // download from S3
    const s3Result = await downloadResume(objectKey);
    // set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${originalFilename}"`);

    // return the PDF
    return s3Result.Body.pipe(res);
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/resumes/:id
 * Deletes the object and DB entry of the resume by its ID in the DB.
 * URL parameter:
 * - id: Resume ID (number)
 */
app.delete('/api/resumes/:id', async (req, res, next) => {
  // input validation
  const resumeId = parseInt(req.params.id);
  if (isNaN(resumeId) || !Number.isInteger(parseFloat(req.params.id))) {
    return res.status(400).json({ error: 'Invalid resume ID' });
  }
  // accept request
  try {
    // delete resume from DB while getting object_key
    const query = `
      DELETE from resumes
      WHERE id = $1
      RETURNING object_key
    `;
    const params = [resumeId];
    const dbResult = await queryWithRetry(query, params);
    if (dbResult.rowCount === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    const objectKey = dbResult.rows[0].object_key;
    // delete from S3
    await deleteResume(objectKey);

    // no content to return
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/jobs
 * Inserts a new job into the DB.
 * Returns the job ID in the DB.
 * Body parameters:
 * - title: string (required)
 * - description: string (required)
 * - adminId: number (required)
 */
app.post('/api/jobs', async (req, res, next) => {
  // input validation
  if (!req.body) {
    return res.status(400).json({ error: 'Missing body' });
  }
  const body = req.body;
  if (!('title' in body && 'description' in body && 'adminId' in body)) {
    return res.status(422).json({ error: 'Missing required fields' });
  }
  if (
    typeof body.title !== 'string' ||
    typeof body.description !== 'string' ||
    typeof body.adminId !== 'number' ||
    !Number.isInteger(body.adminId)
  ) {
    return res.status(422).json({ error: 'Incorrect data type(s) in body' });
  }
  // accept request
  try {
    const query = `
      INSERT INTO jobs (title, description, admin_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    const params = [body.title, body.description, body.adminId];
    const result = await queryWithRetry(query, params);
    const jobData = result.rows[0];

    // return job id
    return res.status(201).json({ jobId: jobData.id });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/jobs
 * Gets all jobs and their data.
 */
app.get('/api/jobs', async (_req, res, next) => {
  try {
    const query = 'SELECT * FROM jobs;';
    const result = await queryWithRetry(query);
    const jobs = result.rows;

    // return jobs
    return res.json({ jobs });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/jobs/:id
 * Gets a job's data by its ID in the DB.
 * URL parameter:
 * - id: Job ID (number)
 */
app.get('/api/jobs/:id', async (req, res, next) => {
  // input validation
  const jobId = parseInt(req.params.id);
  if (isNaN(jobId) || !Number.isInteger(parseFloat(req.params.id))) {
    return res.status(400).json({ error: 'Invalid job ID' });
  }
  // accept request
  try {
    const query = `
      SELECT * FROM jobs
      WHERE id = $1;
    `;
    const params = [jobId];
    const result = await queryWithRetry(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = result.rows[0];

    // return job
    return res.json({ job });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/jobs/:id
 * Deletes a job from the DB by its ID.
 * URL parameter:
 * - id: Job ID (number)
 */
app.delete('/api/jobs/:id', async (req, res, next) => {
  // input validation
  const jobId = parseInt(req.params.id);
  if (isNaN(jobId) || !Number.isInteger(parseFloat(req.params.id))) {
    return res.status(400).json({ error: 'Invalid job ID' });
  }
  // accept request
  try {
    const query = `DELETE FROM jobs WHERE id = $1`;
    const params = [jobId];
    const result = await queryWithRetry(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // no content to return
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/jobs/:id/applications
 * Submits an application for a job by its job ID.
 * Returns the application ID in the DB.
 * URL parameter:
 * - id: Job ID (number)
 * Body parameters:
 * - applicantName: string (required)
 * - applicantEmail: string (required)
 * - resumeId: number (required)
 */
app.post('/api/jobs/:id/applications', async (req, res, next) => {
  // input validation
  const jobId = parseInt(req.params.id);
  if (isNaN(jobId) || !Number.isInteger(parseFloat(req.params.id))) {
    return res.status(400).json({ error: 'Invalid Job ID' });
  }
  if (!req.body) {
    return res.status(400).json({ error: 'Missing body' });
  }
  const body = req.body;
  if (!('applicantName' in body && 'applicantEmail' in body && 'resumeId' in body)) {
    return res.status(422).json({ error: 'Missing required fields' });
  }
  if (
    typeof body.applicantName !== 'string' ||
    typeof body.applicantEmail !== 'string' ||
    typeof body.resumeId !== 'number'
  ) {
    return res.status(422).json({ error: 'Incorrect data type(s) in body' });
  }
  // accept request
  try {
    // see if the jobs exists
    const jobExists = await queryWithRetry('SELECT 1 FROM jobs WHERE id = $1', [jobId]);
    if (jobExists.rowCount === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    // see if the resume exists
    const resumeExists = await queryWithRetry('SELECT 1 FROM resumes WHERE id = $1', [
      body.resumeId,
    ]);
    if (resumeExists.rowCount === 0) {
      return res.status(404).json({ error: 'Resume not found ' });
    }
    // insert application into DB
    const query = `
      INSERT INTO applications
      (applicant_name, applicant_email, resume_id, job_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    const params = [body.applicantName, body.applicantEmail, body.resumeId, jobId];
    const result = await queryWithRetry(query, params);
    const appData = result.rows[0];

    // return application ID
    return res.status(201).json({ applicationId: appData.id });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/jobs/:id/applications
 * Gets all applications for a job by its job ID.
 * URL parameter:
 * - id: Job ID (number)
 */
app.get('/api/jobs/:id/applications', async (req, res, next) => {
  // input validation
  const jobId = parseInt(req.params.id);
  if (isNaN(jobId) || !Number.isInteger(parseFloat(req.params.id))) {
    return res.status(400).json({ error: 'Invalid job ID' });
  }
  // accept request
  try {
    // see if job exists
    const jobExists = await queryWithRetry('SELECT 1 FROM jobs WHERE id = $1', [jobId]);
    if (jobExists.rowCount === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    // get applications
    const query = `
      SELECT * FROM applications
      WHERE job_id = $1
    `;
    const params = [jobId];
    const result = await queryWithRetry(query, params);

    // return applications
    return res.json({
      applications: result.rows,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/applications/:id
 * Gets an application by its ID in the DB.
 * URL parameter:
 * - id: Job ID (number)
 */
app.get('/api/applications/:id', async (req, res, next) => {
  // input validation
  const applicationId = parseInt(req.params.id);
  if (isNaN(applicationId) || !Number.isInteger(parseFloat(req.params.id))) {
    return res.status(400).json({ error: 'Invalid application ID' });
  }
  // accept request
  try {
    // get application
    const query = `
      SELECT * FROM applications
      WHERE id = $1;
    `;
    const params = [applicationId];
    const result = await queryWithRetry(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const application = result.rows[0];

    // return application
    return res.json({ application });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/applications/:id
 * Deletes an application by its ID in the DB.
 * URL parameter:
 * - id: Job ID (number)
 */
app.delete('/api/applications/:id', async (req, res, next) => {
  // input validation
  const applicationId = parseInt(req.params.id);
  if (isNaN(applicationId) || !Number.isInteger(parseFloat(req.params.id))) {
    return res.status(400).json({ error: 'Invalid application ID' });
  }
  // accept request
  try {
    // delete the application
    const query = `
      DELETE FROM applications WHERE id = $1
    `;
    const params = [applicationId];
    const result = await queryWithRetry(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // no content to return
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// Error handler middleware
app.use((err, _req, res, _next) => {
  logger.error(err);

  return res.status(500).json({ error: 'Internal server error' });
});

export default app;
