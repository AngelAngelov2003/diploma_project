const bcrypt = require("bcrypt");
const pool = require("../db");

const getProfile = async (req, res) => {
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
    res.status(500).json({ error: "Failed to load profile" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { full_name, email } = req.body;

    const nextFullName = String(full_name || "").trim();
    const nextEmail = String(email || "").trim().toLowerCase();

    if (!nextFullName) {
      return res.status(400).json({ error: "Full name is required" });
    }

    if (!nextEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailConflict = await pool.query(
      `
        SELECT 1
        FROM users
        WHERE email = $1 AND id <> $2
        LIMIT 1
      `,
      [nextEmail, req.user]
    );

    if (emailConflict.rows.length) {
      return res.status(400).json({ error: "Email already in use by another user" });
    }

    const q = await pool.query(
      `
        UPDATE users
        SET full_name = $2, email = $3, updated_at = NOW()
        WHERE id = $1
        RETURNING id, full_name, email, role, is_verified, is_active, created_at, updated_at
      `,
      [req.user, nextFullName, nextEmail]
    );

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const userQ = await pool.query(
      `
        SELECT id, password_hash
        FROM users
        WHERE id = $1
      `,
      [req.user]
    );

    if (!userQ.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(current_password, userQ.rows[0].password_hash);

    if (!validPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);

    await pool.query(
      `
        UPDATE users
        SET password_hash = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [req.user, newPasswordHash]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to change password" });
  }
};

const getNotificationPreferences = async (req, res) => {
  try {
    await pool.query(
      `
        INSERT INTO user_notification_preferences (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [req.user]
    );

    const q = await pool.query(
      `
        SELECT user_id, email_alerts_enabled, default_notification_frequency, default_min_score, created_at, updated_at
        FROM user_notification_preferences
        WHERE user_id = $1
      `,
      [req.user]
    );

    res.json(
      q.rows[0] || {
        user_id: req.user,
        email_alerts_enabled: true,
        default_notification_frequency: "daily",
        default_min_score: 0,
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to load notification preferences" });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const {
      email_alerts_enabled,
      default_notification_frequency,
      default_min_score,
    } = req.body;

    const existingQ = await pool.query(
      `
        SELECT user_id, email_alerts_enabled, default_notification_frequency, default_min_score
        FROM user_notification_preferences
        WHERE user_id = $1
      `,
      [req.user]
    );

    const current = existingQ.rows[0] || {
      email_alerts_enabled: true,
      default_notification_frequency: "daily",
      default_min_score: 0,
    };

    const nextEmailAlertsEnabled =
      typeof email_alerts_enabled === "boolean"
        ? email_alerts_enabled
        : Boolean(current.email_alerts_enabled);

    const nextFrequency =
      default_notification_frequency !== undefined
        ? String(default_notification_frequency).trim().toLowerCase()
        : current.default_notification_frequency;

    const nextMinScore =
      default_min_score !== undefined
        ? Number(default_min_score)
        : Number(current.default_min_score || 0);

    if (!["daily", "weekly"].includes(nextFrequency)) {
      return res.status(400).json({
        error: "Default notification frequency must be daily or weekly",
      });
    }

    if (!Number.isInteger(nextMinScore) || nextMinScore < 0 || nextMinScore > 100) {
      return res.status(400).json({
        error: "Default minimum score must be between 0 and 100",
      });
    }

    const q = await pool.query(
      `
        INSERT INTO user_notification_preferences (
          user_id,
          email_alerts_enabled,
          default_notification_frequency,
          default_min_score,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET
          email_alerts_enabled = EXCLUDED.email_alerts_enabled,
          default_notification_frequency = EXCLUDED.default_notification_frequency,
          default_min_score = EXCLUDED.default_min_score,
          updated_at = NOW()
        RETURNING user_id, email_alerts_enabled, default_notification_frequency, default_min_score, created_at, updated_at
      `,
      [req.user, nextEmailAlertsEnabled, nextFrequency, nextMinScore]
    );

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getNotificationPreferences,
  updateNotificationPreferences,
};