const jwt = require("jsonwebtoken");
const pool = require("../db");

const authorize = async (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res.status(401).json({ error: "Липсва заглавка за оторизация" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Invalid authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secret_key");

    const userQ = await pool.query(
      `
        SELECT id, full_name, email, role, is_active, is_verified
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
      return res.status(403).json({ error: "Профилът е деактивиран. Моля, влезте отново." });
    }

    // Не блокирай администраторски профили, създадени преди въвеждането
    // на потвърждение на имейл. Останалите роли задължително се проверяват.
    if (user.role !== "admin" && user.is_verified !== true) {
      return res.status(403).json({ error: "Профилът не е потвърден. Моля, потвърдете имейла си и влезте отново." });
    }

    req.user = user.id;
    req.userRole = user.role || "user";
    req.userData = { ...user, is_verified: user.role === "admin" ? true : user.is_verified };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Token is not valid" });
  }
};

module.exports = authorize;