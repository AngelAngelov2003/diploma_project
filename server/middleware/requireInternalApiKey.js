const requireInternalApiKey = (req, res, next) => {
  const expectedKey = String(process.env.ML_INTERNAL_API_KEY || "").trim();
  const providedKey = String(req.headers["x-internal-api-key"] || "").trim();

  if (!expectedKey) {
    return res.status(503).json({ error: "Вътрешният API ключ не е конфигуриран" });
  }

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ error: "Неоторизиран достъп internal request" });
  }

  return next();
};

module.exports = requireInternalApiKey;
