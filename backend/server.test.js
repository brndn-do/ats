import request from "supertest";
import app from "./app.js";

describe("GET /", () => {
  test("returns status: ok message: ATS API", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.text);
    expect(body.status).toBe("ok");
    expect(body.message).toBe("ATS API")
  });
});
