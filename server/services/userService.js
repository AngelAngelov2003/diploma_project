const pool = require("../db");

const findUserById = async (userId) => {
  const q = await pool.query(
    `
      SELECT id, full_name, email, role, is_verified, is_active, created_at, updated_at
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return q.rows[0] || null;
};

const findUserAuthByEmail = async (email) => {
  const q = await pool.query(
    `
      SELECT *
      FROM users
      WHERE email = $1
    `,
    [email]
  );

  return q.rows[0] || null;
};

const ensureNotificationPreferences = async (userId) => {
  await pool.query(
    `
      INSERT INTO user_notification_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );
};

const getNotificationPreferences = async (userId) => {
  const q = await pool.query(
    `
      SELECT user_id, email_alerts_enabled, default_notification_frequency, default_min_score, created_at, updated_at
      FROM user_notification_preferences
      WHERE user_id = $1
    `,
    [userId]
  );

  return q.rows[0] || null;
};

const updateNotificationPreferences = async ({
  userId,
  emailAlertsEnabled,
  defaultFrequency,
  defaultMinScore,
}) => {
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
    [userId, emailAlertsEnabled, defaultFrequency, defaultMinScore]
  );

  return q.rows[0];
};

module.exports = {
  findUserById,
  findUserAuthByEmail,
  ensureNotificationPreferences,
  getNotificationPreferences,
  updateNotificationPreferences,
};