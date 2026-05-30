const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const crypto = require("crypto");
const { sendEmail } = require("../services/emailService");
const { validateStrongPassword } = require("../utils/passwordValidation");
const billingService = require("../services/billingService");

const register = async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    const passwordCheck = validateStrongPassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        error: `Password must contain ${passwordCheck.errors.join(", ")}.`,
      });
    }

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

    const billing = await billingService.getUserPremiumState(req.user, q.rows[0].role);
    res.json({ ...q.rows[0], billing });
  } catch (err) {
    res.status(500).json({ error: "Failed to load current user" });
  }
};


const getClientBaseUrl = () => (
  process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000"
).replace(/\/$/, "");

const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const forgotPassword = async (req, res) => {
  const genericMessage = "If an account exists, a password reset link has been sent.";

  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const userResult = await pool.query(
      "SELECT id, email, full_name, is_active FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (!userResult.rows.length || userResult.rows[0].is_active === false) {
      return res.json({ message: genericMessage });
    }

    const user = userResult.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const resetUrl = `${getClientBaseUrl()}/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your Fishing Atlas password",
      text: `Use this link to reset your password. It expires in 1 hour: ${resetUrl}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2>Password reset</h2>
          <p>Hello ${user.full_name || "there"},</p>
          <p>Use the secure link below to reset your Fishing Atlas password. The link expires in 1 hour.</p>
          <p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700">Reset password</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    res.json({ message: genericMessage });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ error: "Failed to send reset email" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");

    if (!token) return res.status(400).json({ error: "Reset token is required" });

    const passwordCheck = validateStrongPassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ error: `Password must contain ${passwordCheck.errors.join(", ")}.` });
    }

    const tokenHash = hashResetToken(token);
    const tokenResult = await pool.query(
      `
        SELECT prt.id, prt.user_id, u.is_active
        FROM password_reset_tokens prt
        JOIN users u ON u.id = prt.user_id
        WHERE prt.token_hash = $1
          AND prt.used_at IS NULL
          AND prt.expires_at > NOW()
        LIMIT 1
      `,
      [tokenHash]
    );

    if (!tokenResult.rows.length || tokenResult.rows[0].is_active === false) {
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }

    const bcryptPassword = await bcrypt.hash(password, 10);
    const userId = tokenResult.rows[0].user_id;

    await pool.query("BEGIN");
    try {
      await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [bcryptPassword, userId]);
      await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [userId]);
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }

    res.json({ message: "Password changed successfully. You can now log in." });
  } catch (err) {
    console.error("resetPassword error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
};

module.exports = {
  register,
  login,
  me,
  forgotPassword,
  resetPassword,
};