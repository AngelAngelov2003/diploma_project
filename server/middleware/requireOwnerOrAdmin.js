const requireOwnerOrAdmin = (req, res, next) => {
  if (req.userRole !== "owner" && req.userRole !== "admin") {
    return res.status(403).json({ error: "Owner or admin access required" });
  }

  next();
};

module.exports = requireOwnerOrAdmin;