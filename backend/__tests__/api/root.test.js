import request from "supertest";
import app from "../../app.js";

it("GET / should retrieve status: ok message: ATS API", async () => {
  // Action: send GET request to root route
  const res = await request(app).get("/");
  // Assertions
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.text);
  expect(body.status).toBe("ok");
  expect(body.message).toBe("ATS API");
});
