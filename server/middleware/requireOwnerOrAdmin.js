const requireOwnerOrAdmin = (req, res, next) => {
  if (req.userRole !== "owner" && req.userRole !== "admin") {
    return res.status(403).json({ error: "Изисква се достъп като собственик или администратор" });
  }

  next();
};

module.exports = requireOwnerOrAdmin;