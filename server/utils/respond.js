const ok = (res, data = {}, status = 200) => {
  return res.status(status).json(data);
};

const created = (res, data = {}) => {
  return res.status(201).json(data);
};

const badRequest = (res, message = "Bad request", extra = {}) => {
  return res.status(400).json({
    error: message,
    ...extra,
  });
};

const unauthorized = (res, message = "Unauthorized", extra = {}) => {
  return res.status(401).json({
    error: message,
    ...extra,
  });
};

const forbidden = (res, message = "Forbidden", extra = {}) => {
  return res.status(403).json({
    error: message,
    ...extra,
  });
};

const notFound = (res, message = "Not found", extra = {}) => {
  return res.status(404).json({
    error: message,
    ...extra,
  });
};

const serverError = (res, message = "Internal server error", extra = {}) => {
  return res.status(500).json({
    error: message,
    ...extra,
  });
};

module.exports = {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
};