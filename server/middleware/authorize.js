const jwt = require("jsonwebtoken");
const pool = require("../db");

const authorize = async (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Invalid authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secret_key");

    const userQ = await pool.query(
      `
        SELECT id, full_name, email, role, is_active
        FROM users
        WHERE id = $1
      `,
      [payload.user_id]
    );

    if (!userQ.rows.length) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = userQ.rows[0];

    if (user.is_active === false) {
      return res.status(403).json({ error: "User account is inactive" });
    }

    req.user = user.id;
    req.userRole = user.role || "user";
    req.userData = user;

    next();
  } catch (err) {
    return res.status(401).json({ error: "Token is not valid" });
  }
};

module.exports = authorize;