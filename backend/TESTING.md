# Testing Strategy

This project uses a layered testing approach. Each layer has a specific purpose, ensuring our application is reliable while keeping tests fast and easy to maintain.

---

### 1. Unit Tests

-   **Goal:** Test individual, self-contained modules (like `db.js` or `s3.js`) in complete isolation.
-   **Location:** `__tests__/unit/`
-   **Mocks:** All external dependencies are mocked.
-   **Example:** Testing the retry logic in `db.js` without a real database.

---

### 2. API Tests

-   **Goal:** Test the application's main logic, including routing, validation, and error handling for each endpoint. This is our primary testing layer for `app.js`, testing route handlers in the context of a real HTTP request.
-   **Location:** `__tests__/api/`
-   **Mocks:** External services (Database, S3) are mocked.
-   **Example:** Testing the `POST /api/resumes` endpoint by sending a request and asserting the response, while mocking the S3 upload itself.

---

### 3. Integration Tests

-   **Goal:** Verify the application's core, standalone resources can perform basic operations against real external services.
-   **Location:** `__tests__/integration/`
-   **Mocks:** None. These tests connect to a live test database and S3 bucket.
-   **Example:** Confirming that a resume file can actually be uploaded to S3 and info saved to the database.

---

### 4. End-to-End (E2E) Tests

-   **Goal:** Simulate a complete user workflow that involves multiple API resources working together.
-   **Location:** `__tests__/e2e/`
-   **Mocks:** None.
-   **Example:** Testing the entire hiring flow: create a job, upload a resume, **apply for the job**, and verify the application exists. This is the designated place to test resources like applications that link other core resources together.

---

### Error Testing

Error paths are primarily tested within the **API Tests** (`__tests__/api/`).

-   **Client Errors (4xx):** We test for invalid user input by sending bad requests (e.g., missing fields, wrong file types) and asserting that the correct `4xx` status code and error message are returned.

-   **Server Errors (5xx):** We test for internal failures by mocking our external dependencies (`db`, `s3`) to throw errors and asserting that the API handles them gracefully by returning a `5xx` status code.

---

### Running Tests

Use `jest` and specify a path to run a specific test suite:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test -- __tests__/unit

# Run only API tests
npm run test -- __tests__/api
```