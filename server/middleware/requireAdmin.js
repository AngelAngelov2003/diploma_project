const requireAdmin = (req, res, next) => {
  if (req.userRole !== "admin") {
    return res.status(403).json({ error: "Нужен е администраторски достъп" });
  }

  next();
};

module.exports = requireAdmin;