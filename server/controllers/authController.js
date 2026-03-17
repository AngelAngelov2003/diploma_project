const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const register = async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length > 0) {
      return res.status(401).json("User already exists");
    }

    const bcryptPassword = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      `
        INSERT INTO users (full_name, email, password_hash, role, is_verified, is_active)
        VALUES ($1, $2, $3, 'user', FALSE, TRUE)
        RETURNING id, full_name, email, role, is_verified, is_active, created_at, updated_at
      `,
      [full_name, email, bcryptPassword]
    );

    await pool.query(
      `
        INSERT INTO user_notification_preferences (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [newUser.rows[0].id]
    );

    const token = jwt.sign(
      { user_id: newUser.rows[0].id },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: newUser.rows[0],
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(401).json("Password or Email is incorrect");
    }

    if (user.rows[0].is_active === false) {
      return res.status(403).json({ error: "Your account is inactive" });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json("Password or Email is incorrect");
    }

    const token = jwt.sign(
      { user_id: user.rows[0].id },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        id: user.rows[0].id,
        full_name: user.rows[0].full_name,
        email: user.rows[0].email,
        role: user.rows[0].role || "user",
        is_verified: user.rows[0].is_verified,
        is_active: user.rows[0].is_active,
        created_at: user.rows[0].created_at,
        updated_at: user.rows[0].updated_at,
      },
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const me = async (req, res) => {
  try {
    const q = await pool.query(
      `
        SELECT id, full_name, email, role, is_verified, is_active, created_at, updated_at
        FROM users
        WHERE id = $1
      `,
      [req.user]
    );

    if (!q.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to load current user" });
  }
};

module.exports = {
  register,
  login,
  me,
};