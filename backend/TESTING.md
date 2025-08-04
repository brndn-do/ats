# Testing Strategy

This project uses a layered testing approach to ensure the application is reliable, maintainable, and scalable. Each layer has a specific purpose, from testing individual functions in isolation to verifying complete user workflows.

---

### 1. Unit Tests

-   **Goal:** Test individual, self-contained modules in complete isolation.
-   **Location:** `__tests__/unit/`
-   **Mocks:** All external dependencies are mocked.
-   **Examples:**
    -   Testing database retry logic without a real database.
    -   Testing S3 URL generation without a real S3 bucket.

### 2. API Tests

-   **Goal:** Test the application's main logic, including routing, validation, and error handling for each endpoint.
-   **Location:** `__tests__/api/`
-   **Mocks:** External services (Database, S3) are mocked.
-   **Examples:**
    -   Testing the `POST /api/resumes` endpoint by sending a request and asserting the response, while mocking the S3 upload.
    -   Testing error handling for invalid input.

### 3. Integration Tests

-   **Goal:** Verify the application's core, standalone resources can perform basic operations against real external services.
-   **Location:** `__tests__/integration/`
-   **Mocks:** None. These tests connect to a live test database and S3 bucket.
-   **Example:** Confirming that a resume file can be uploaded to S3 and its metadata saved to the database.

### 4. End-to-End (E2E) Tests

-   **Goal:** Simulate a complete user workflow that involves multiple API resources working together.
-   **Location:** `__tests__/e2e/`
-   **Mocks:** None.
-   **Example:** Testing the entire hiring flow: creating a job, uploading a resume, applying for the job, and verifying the application.

---

### Running Tests

You can run a single test file or a specific suite using the scripts defined in `package.json`.

-   **Run a single test file:**
    ```bash
    npm test -- __tests__/api/jobs.test.js
    ```

**Note on Concurrency:** Integration and E2E tests clear the database and object storage, while running sequentially using the `--runInBand` flag to prevent race conditions.

-   **Run a specific suite:**
    -   `npm run test:unit`
    -   `npm run test:api`
    -   `npm run test:integration`
    -   `npm run test:e2e`
-   **Run combined suites:**
    -   `npm run test:local` (Unit and API tests)
    -   `npm run test:remote` (Integration and E2E tests)
-   **Run all tests:**
    -   `npm run test:all`
-   **Run all tests with coverage:**
    -   `npm run test:coverage`

---

### Test Files

#### Unit Tests (`__tests__/unit/`)

-   `services/db.test.js`
-   `services/s3.test.js`
-   `utils/createTokens.test.js`
-   `utils/hash.test.js`

#### API Tests (`__tests__/api/`)

-   `applications.test.js`
-   `auth.test.js`
-   `jobs.test.js`
-   `resumes.test.js`
-   `root.test.js`

#### Integration Tests (`__tests__/integration/`)

-   `jobs.integration.test.js`
-   `resumes.integration.test.js`

#### End-to-End Tests (`__tests__/e2e/`)

-   `hiring.e2e.test.js`
