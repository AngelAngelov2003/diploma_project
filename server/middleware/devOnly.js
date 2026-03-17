const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).send("Forbidden");
  }

  next();
};

module.exports = devOnly;