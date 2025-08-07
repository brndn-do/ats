# Applicant Tracking System (ATS) – _Work in Progress_

A full‑stack web application for posting jobs, accepting applications with résumé uploads, and managing candidates – built as a learning project.

---

## Features & Roadmap

This project is currently focused on the backend API. The front-end is not yet started.

| Status    | Feature                                                |
| :-------- | :----------------------------------------------------- |
| `✓ Done`  | Core API for managing jobs, applications, and resumes. |
| `✓ Done`  | User authentication                                    |
| `- To Do` | User authorization                                     |
| `- To Do` | Automated résumé parsing and keyword matching.         |
| `- To Do` | Front-end React UI.                                    |
| `- To Do` | Containerization and deployment.                       |

### Planned Improvements

- [ ] Refactor database schema to use `GENERATED AS IDENTITY` instead of `SERIAL`.
- [ ] Add request rate limiting and CORS configuration.
- [ ] Implement comprehensive input validation with a library like `zod` or `Joi`.
- [ ] Replace raw SQL with an ORM like Prisma or Drizzle.
- [ ] Add a CI/CD workflow (e.g., GitHub Actions) for automated linting, testing, and deployment.

---

## Tech Stack

| Layer     | Technology                      |
| --------- | ------------------------------- |
| Back-end  | Node.js, Express.js             |
| Database  | PostgreSQL (AWS RDS)            |
| Storage   | AWS S3 (prod), MinIO (dev/test) |
| Testing   | Jest, Supertest                 |
| Front-end | React, Vite (TBD)               |
| Auth      | JSON Web Tokens + bcrypt        |
| DevOps    | Docker, Docker Compose          |

---

## Testing

This project uses a layered testing strategy to ensure correctness and reliability.

- **Unit & API Tests:** These form the foundation of the test suite. They are fast, isolated, and mock external services for predictable results.
- **Integration & E2E Tests:** These tests run against live, containerized PostgreSQL and MinIO (S3) services to verify real-world behavior and interactions between components.

For more info on testing, please see the **[TESTING.md](backend/TESTING.md)** file.

---

## Project Structure

```
backend/
├── __tests__/
│   ├── api/          # API tests (mocking DB and S3)
│   ├── e2e/          # End-to-end tests (live services)
│   ├── fixtures/     # Test data (e.g., sample resume)
│   ├── integration/  # Integration tests (live services)
│   └── unit/         # Unit tests (focused, no external services)
├── database/
│   └── db_schema.pgsql # SQL schema for the database
├── node_modules/
├── src/
│   ├── services/
│   │   ├── db.js     # PostgreSQL helper pool
│   │   └── s3.js     # AWS S3 upload/download helpers
│   ├── utils/
│   │   ├── createTokens.js # JWT creation logic
│   │   ├── hash.js         # Hashing utility for tokens
│   │   └── logger.js       # Logging utility
│   ├── app.js        # Express application and routes
│   └── server.js     # Server entry point
├── .env.template     # Environment variables (template)
├── package.json
└── ...
```

---

### Prerequisites

- [Docker & Docker Compose](https://docs.docker.com/get-docker/)
- [OpenSSL](https://openssl.org) or [Node.js](https://nodejs.org/) (for generating secrets)

## Getting Started

To get the application running, follow these steps:

### 1. Clone the Repository

```bash
git clone https://github.com/brndn-do/ats.git
cd ats
```

### 2. Set environment variables

Generate a secret to use for JWT, using either OpenSSL:

```bash
openssl rand -hex 32
```

or Node with Crypto:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then, copy the generated string and set it as your JWT_SECRET inside `.env.template`:

```.env
JWT_SECRET=REPLACE_WITH_YOUR_SECRET
```

Then, rename the file to .env:

```bash
mv .env.template .env
```

### 3. Build and Run

The following command will build the images and start the containers for the backend, database, and object storage:

```bash
docker-compose up -d
```

Then, you can run the following command to check each container's logs:

```bash
docker-compose logs
```

Note that the backend container depends on the Postgres and Minio containers. If you do not see any logs for the backend, wait and try running the command again.

### 4. Set Up Database and Storage

Next, set up the databases and create the storage buckets. These only need to be run once.

```bash
# Load schema into dev DB
docker-compose exec -T postgres psql -U postgres -d devdb < backend/database/db_schema.pgsql

# Create test DB from the 'postgres' admin DB
docker-compose exec -T postgres psql -U postgres -d postgres -c "CREATE DATABASE testdb"

# Load schema into test DB
docker-compose exec -T postgres psql -U postgres -d testdb < backend/database/db_schema.pgsql

# Create MinIO alias and buckets
docker-compose exec minio mc alias set minio http://localhost:9000 minioadmin minioadmin
docker-compose exec minio mc mb minio/devbucket
docker-compose exec minio mc mb minio/testbucket
```

### 5. Development Workflow

All development tasks, such as running tests, linting, or formatting code, should be executed inside the running `backend` container. This ensures a consistent and isolated environment.

If you haven't, start the services first:

```bash
docker-compose up -d
```

Then, use `docker-compose exec` to run scripts inside the `backend` container. Using the `-t` flag provides a colorized output.

```bash
# Run all tests
docker-compose exec -t backend npm run test:all

# Lint the codebase
docker-compose exec -t backend npm run lint

# Format the codebase
docker-compose exec -t backend npm run format
```

To open an interactive shell inside the container, run:

```bash
docker-compose exec -it backend sh
```

To exit the shell, run:

```sh
exit
```

### 6. Teardown

To stop the containers, run:

```bash
docker-compose down
```

---

## API Reference

### Authentication

| Method | Endpoint            | Description                                   |
| ------ | ------------------- | --------------------------------------------- |
| POST   | `/api/auth/login`   | **Admin** - Authenticate and get access token |
| POST   | `/api/auth/logout`  | **Admin** – Invalidate refresh token          |
| POST   | `/api/auth/refresh` | **Admin** – Get new access token              |

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

> **HTTP 400** for malformed requests, **404** for not found, **422** for validation errors. **401/403** for authentication/authorization errors.
