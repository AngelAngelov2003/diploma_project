const express = require("express");
const request = require("supertest");
const requireAdmin = require("../middleware/requireAdmin");
const requireInternalApiKey = require("../middleware/requireInternalApiKey");

const buildApp = () => {
  const app = express();
  app.get("/admin", (req, res, next) => {
    req.userRole = req.headers["x-test-role"];
    next();
  }, requireAdmin, (req, res) => res.json({ ok: true }));
  app.get("/internal", requireInternalApiKey, (req, res) => res.json({ ok: true }));
  return app;
};

describe("Security middleware", () => {
  const originalKey = process.env.ML_INTERNAL_API_KEY;

  afterEach(() => {
    process.env.ML_INTERNAL_API_KEY = originalKey;
  });

  test("denies non-admin users", async () => {
    const res = await request(buildApp()).get("/admin").set("x-test-role", "user");
    expect(res.status).toBe(403);
  });

  test("allows admin users", async () => {
    const res = await request(buildApp()).get("/admin").set("x-test-role", "admin");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("denies missing internal API key", async () => {
    process.env.ML_INTERNAL_API_KEY = "secret-test-key";
    const res = await request(buildApp()).get("/internal");
    expect(res.status).toBe(401);
  });

  test("allows matching internal API key", async () => {
    process.env.ML_INTERNAL_API_KEY = "secret-test-key";
    const res = await request(buildApp()).get("/internal").set("x-internal-api-key", "secret-test-key");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
