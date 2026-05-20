const requireInternalApiKey = (req, res, next) => {
  const expectedKey = String(process.env.ML_INTERNAL_API_KEY || "").trim();
  const providedKey = String(req.headers["x-internal-api-key"] || "").trim();

  if (!expectedKey) {
    return res.status(503).json({ error: "Internal API key is not configured" });
  }

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ error: "Unauthorized internal request" });
  }

  return next();
};

module.exports = requireInternalApiKey;
