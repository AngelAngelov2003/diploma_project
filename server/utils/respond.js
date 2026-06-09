const ok = (res, data = {}, status = 200) => {
  return res.status(status).json(data);
};

const created = (res, data = {}) => {
  return res.status(201).json(data);
};

const badRequest = (res, message = "Невалидна заявка", extra = {}) => {
  return res.status(400).json({
    error: message,
    ...extra,
  });
};

const unauthorized = (res, message = "Неоторизиран достъп", extra = {}) => {
  return res.status(401).json({
    error: message,
    ...extra,
  });
};

const forbidden = (res, message = "Забранен достъп", extra = {}) => {
  return res.status(403).json({
    error: message,
    ...extra,
  });
};

const notFound = (res, message = "Не е намерено", extra = {}) => {
  return res.status(404).json({
    error: message,
    ...extra,
  });
};

const serverError = (res, message = "Вътрешна грешка на сървъра", extra = {}) => {
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