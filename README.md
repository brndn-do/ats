# Applicant Tracking System (ATS) – _Work in Progress_

A full‑stack web application for posting jobs, accepting applications with résumé uploads, and managing candidates – built as a learning project.

---

## Features & Roadmap

This project is currently focused on the backend API. The front-end is not yet started.

| Status      | Feature                                        |
| :---------- | :--------------------------------------------- |
| `✓ Done`    | Core API for managing jobs and applications.   |
| `✓ Done`    | PDF résumé uploads to and downloads from S3.   |
| `✓ Done`    | Comprehensive testing suite.                   |
| `~ In Prog` | User authentication and authorization (JWT).   |
| `- To Do`   | Automated résumé parsing and keyword matching. |
| `- To Do`   | Front-end React UI.                            |
| `- To Do`   | Containerization and deployment.               |

### Planned Improvements

- [ ] Refactor database schema to use `GENERATED AS IDENTITY` instead of `SERIAL`.
- [ ] Move error handling into centralized middleware.
- [ ] Add request rate limiting and CORS configuration.
- [ ] Implement comprehensive input validation with a library like `zod` or `Joi`.
- [ ] Add structured logging (e.g., `pino`, `winston`) with request correlation IDs.
- [ ] Replace raw SQL with an ORM like Prisma or Drizzle.
- [ ] Add a CI/CD workflow (e.g., GitHub Actions) for automated linting, testing, and deployment.

---

## Tech Stack

| Layer     | Technology                     |
| --------- | ------------------------------ |
| Back-end  | Node.js, Express.js            |
| Database  | PostgreSQL (AWS RDS)           |
| Storage   | AWS S3 (résumé PDFs)           |
| Testing   | Jest, Supertest                |
| Front-end | React, Vite (TBD)              |
| Auth      | JSON Web Tokens + bcrypt (TBD) |

---

## Testing

This project uses a layered testing strategy to ensure correctness and maintainability. We have a solid foundation of **Unit** and **API** tests that mock external dependencies for speed and reliability.

Work is in progress to build out the **Integration** and **End-to-End (E2E)** tests, which run against live services to verify real-world behavior.

For a detailed breakdown of the testing layers, mock strategies, and how to run specific test suites, please see the **[TESTING.md](backend/TESTING.md)** file.

---

## Project Structure

```
backend/
├─ __tests__/              # Unit, API, Integration, and E2E tests
├─ db_schema.pgsql         # SQL schema
├─ db.js                   # PostgreSQL helper pool
├─ s3.js                   # AWS S3 upload/download helpers
├─ app.js                  # Express application and routes
├─ server.js               # Server entry point
└─ .env.example            # Sample environment variables
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

Copy the sample file and fill in your credentials for PostgreSQL and AWS S3.

```bash
cp .env.example .env
```

### 3 · Create the Database Schema

Ensure your PostgreSQL server is running and you have created the database specified in your `.env` file.

```bash
psql -U <your_db_user> -d <your_db_name> -f db_schema.pgsql
```

### 4 · Run the Server

```bash
npm start
```

The API will start on `http://localhost:3000` by default.

### 5 · Run Tests

```bash
npm test
```

See [TESTING.md](TESTING.md) for more detailed testing commands.

---

## API Reference

### Jobs

| Method | Endpoint        | Description                         |
| ------ | --------------- | ----------------------------------- |
| GET    | `/api/jobs`     | Get a list of all jobs.             |
| POST   | `/api/jobs`     | **Admin** – Create a new job.       |
| GET    | `/api/jobs/:id` | Get a single job by its ID.         |
| DELETE | `/api/jobs/:id` | **Admin** – Delete a job by its ID. |

### Applications

| Method | Endpoint                     | Description                                           |
| ------ | ---------------------------- | ----------------------------------------------------- |
| GET    | `/api/applications/:id`      | Get a single application by its ID.                   |
| DELETE | `/api/applications/:id`      | **Admin** – Delete an application by its ID.          |
| GET    | `/api/jobs/:id/applications` | **Admin** – List all applications for a specific job. |
| POST   | `/api/jobs/:id/applications` | Submit a new application for a specific job.          |

### Résumés

| Method | Endpoint           | Description                              |
| ------ | ------------------ | ---------------------------------------- |
| POST   | `/api/resumes`     | Upload a new résumé PDF.                 |
| GET    | `/api/resumes/:id` | **Admin** – Download a résumé by its ID. |
| DELETE | `/api/resumes/:id` | **Admin** – Delete a résumé by its ID.   |

### Authentication

| Method | Endpoint            | Description                                   |
| ------ | ------------------- | --------------------------------------------- |
| POST   | `/api/auth/login`   | **Admin** - Authenticate and get access token |
| POST   | `/api/auth/logout`  | **Admin** – Invalidate refresh token          |
| POST   | `/api/auth/refresh` | **Admin** – Get new access token              |

> **HTTP 400** for malformed requests, **404** for not found, **422** for validation errors. **401/403** will be added once auth is live.
