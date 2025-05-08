# Applicant Tracking System (ATS) – *Work in Progress*

A full‑stack web application for posting jobs, accepting applications with résumé uploads, and managing candidates – built as a learning project.

---

## Roadmap

| Status | Item                                                                    |
| ------ | ----------------------------------------------------------------------- |
| ✓      | Public job listings (GET `/api/jobs`)                                   |
| ✓      | Submit application with résumé upload                                   |
| ✓      | Admin CRUD for jobs, applications & résumés                             |
| \~     | Front‑end React UI (public job list, application form, admin dashboard) |
| -      | JWT‑based auth with a hard‑coded admin account                          |
| -      | Résumé text parsing & keyword matching                                  |
| -      | Login & status page                                                     |
| -      | Unit & integration tests                                                |
| -      | Deployment (containerize & host)                                        |

---

## Todo's
- Add file upload size limits and type checks
- Refactor database schema to use GENERATED AS IDENTITY instead of SERIAL
- Move error handling into centralized middleware
- Add request rate limiting and CORS config
- Add comprehensive input validation using zod or Joi
- Add frontend form validation and API error handling
- Stream résumé downloads from S3 instead of buffering
- Write integration tests for key routes (e.g., application submission, résumé upload)
- Add structured logging (e.g., pino, winston) with request correlation IDs
- Implement exponential backoff for retries in S3/database operations
- Replace raw SQL with an ORM like Prisma or Drizzle
- Add CI/CD workflow (e.g., GitHub Actions) for linting, testing, and deploy

---

## Tech Stack

| Layer     | Technology                     |
| --------- | ------------------------------ |
| Front‑end | React, Vite                    |
| Back‑end  | Node, Express                  |
| Database  | PostgreSQL (AWS RDS)           |
| Storage   | AWS S3 (résumé PDFs)           |
| Auth      | JSON Web Tokens + bcrypt (TBD) |
| Dev Tools | ESLint + Prettier              |

---

## Project Structure (server)

```
backend/
├─ db_schema.pgsql         # SQL schema
├─ db.js                   # PostgreSQL helper pool
├─ s3.js                   # AWS S3 upload/download helpers
├─ server.js               # Express entry point + routes
└─ .env.example            # Sample environment variables
frontend/
├─ 
```

---

## Getting Started

### 1 · Clone & Install

```bash
git clone https://github.com/brndn-do/ats.git
cd ats/backend
npm install
```

### 2 · Set Environment Variables

Copy the sample file and fill in your credentials:

```bash
cp .env.example .env
```

`.env.example` snippet:

```env
# PostgreSQL
DB_USER=
DB_HOST=
DB_NAME=
DB_PASSWORD=
DB_PORT=5432

# AWS S3
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
```

### 3 · Create the Database

```bash
psql -U postgres -d ats -f db_schema.pgsql
```

### 4 · Run the Server

```bash
node server.js
```

The API will start on `http://localhost:3000`.

---

## API Reference (v0)

### Jobs

| Method | Endpoint                     | Description                             |
| ------ | ---------------------------- | --------------------------------------- |
| GET    | `/api/jobs`                  | List all jobs                           |
| POST   | `/api/jobs`                  | **Admin** – Create a job                |
| GET    | `/api/jobs/:id`              | Fetch one job                           |
| DELETE | `/api/jobs/:id`              | **Admin** – Delete a job                |
| GET    | `/api/jobs/:id/applications` | **Admin** – List applications for a job |
| POST   | `/api/jobs/:id/applications` | Submit an application                   |

### Applications

| Method | Endpoint                | Description                       |
| ------ | ----------------------- | --------------------------------- |
| GET    | `/api/applications/:id` | Fetch an application              |
| DELETE | `/api/applications/:id` | **Admin** – Delete an application |

### Résumés

| Method | Endpoint           | Description                 |
| ------ | ------------------ | --------------------------- |
| POST   | `/api/resumes`     | Upload résumé PDF           |
| GET    | `/api/resumes/:id` | **Admin** – Download résumé |
| DELETE | `/api/resumes/:id` | **Admin** – Delete résumé   |

> **HTTP 400** for malformed requests, **422** for validation errors, **401/403** will be added once auth is live.

---
