# Testing Strategy

This project uses a layered testing approach to ensure the application is reliable, maintainable, and scalable. Each layer has a specific purpose, from testing individual functions in isolation to verifying complete user workflows against live-like services.

## Testing Layers

| Test Type | Location | Dependencies | Purpose |
| :--- | :--- | :--- | :--- |
| **Unit** | `__tests__/unit/` | None (fully mocked) | Test individual modules in complete isolation. |
| **API** | `__tests__/api/` | Mocked DB & S3 | Test API routes, request/response logic, and error handling without external services. |
| **Integration** | `__tests__/integration/` | **Local Docker** | Verify that the application can correctly interact with a real database and object storage. |
| **End-to-End** | `__tests__/e2e/` | **Local Docker** | Simulate a complete user workflow involving multiple API resources working together. |

---

## Local Testing Environment Setup (One-Time)

For integration and end-to-end tests, we use local Docker containers to simulate live PostgreSQL and S3 services. This provides fast, reliable, and free testing without relying on a network connection or cloud resources.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [Docker](https://www.docker.com/products/docker-desktop/)
*   [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)

### Step 1: Start the Local Services

From the **root directory** of the project (`/home/brndn-do/repos/ats/`), start the containers in the background.

```bash
docker-compose up -d
```

This command will start a PostgreSQL container on port `5432` and a MinIO (S3-compatible) container on port `9000` (API) and `9001` (Web Console).

### Step 2: Create the S3 Bucket

The test suite requires a bucket named `test-bucket` to exist in the local S3 service.

1.  Open your web browser and navigate to the MinIO console: **http://localhost:9001**
2.  Log in with the default credentials:
    *   **Username:** `minioadmin`
    *   **Password:** `minioadmin`
3.  Click on the **"Buckets"** section in the sidebar, then click **"Create Bucket"**.
4.  Enter the bucket name `test-bucket` and click "Create Bucket".

### Step 3: Apply the Database Schema

The local PostgreSQL database starts empty. You need to create the tables by applying the schema.

1.  First, find the name of your running PostgreSQL container:
    ```bash
    docker ps
    # The name will be in the NAMES column, e.g., ats-postgres-1
    ```
2.  Now, run the following command from the project root, replacing `<your_container_name>` with the name you found.
    ```bash
    # Example: docker exec -i ats-postgres-1 ...
    docker exec -i <your_container_name> psql -U testuser -d testdb < backend/database/db_schema.pgsql
    ```
    If the command is successful, it will produce no output.

Your local testing environment is now fully configured.

---

## Running Tests

All test commands should be run from the `backend` directory.

### Running Local-Only Tests (No Docker Needed)

These tests mock all external dependencies and do not require the Docker containers to be running. They are extremely fast and ideal for rapid feedback during development.

```bash
# Run all unit and API tests
npm run test:local

# Run only unit tests
npm run test:unit

# Run only API tests
npm run test:api
```

### Running Integration & E2E Tests (Docker Required)

Ensure your Docker containers are running (`docker-compose up -d`) before executing these commands.

```bash
# Run all integration and E2E tests
npm run test:remote

# Run only integration tests
npm run test:integration

# Run only E2E tests
npm run test:e2e
```

### Running All Tests

To run every test from every layer:

```bash
npm run test:all
```

To run all tests and generate a coverage report:

```bash
npm run test:coverage
```

---

## Daily Workflow & Troubleshooting

### Daily Commands

1.  **Start services:** `docker-compose up -d`
2.  **Run tests:** `npm run test:remote` (or any other test script)
3.  **Stop services:** `docker-compose down`

### Troubleshooting

*   **Cannot log into MinIO Console:** If you can't log in with `minioadmin`/`minioadmin`, the data volume may be corrupted. To fix it, run these commands from the project root:
    ```bash
    docker-compose down
    docker volume rm ats_minio_data # Use the correct volume name from 'docker volume ls'
    docker-compose up -d
    ```
    Then, re-create the bucket as described in the setup steps.

*   **Connect to the local database directly:** To debug or manually inspect the test database, use this command from the project root:
    ```bash
    # Replace <your_container_name> with the actual container name
    docker exec -it <your_container_name> psql -U testuser -d testdb
    ```
    You can then run SQL queries directly. Type `\q` to exit.
