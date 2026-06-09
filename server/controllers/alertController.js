const pool = require("../db");
const { fetchForecastForLatLng } = require("../services/forecastService");

const getAlerts = async (req, res) => {
  try {
    const q = await pool.query(
      `
        SELECT
          s.id,
          s.water_body_id,
          s.is_active,
          s.is_favorite,
          s.notification_frequency,
          s.created_at,
          w.name AS lake_name
        FROM lake_subscriptions s
        JOIN water_bodies w ON w.id = s.water_body_id
        WHERE s.user_id = $1
        ORDER BY s.is_favorite DESC, w.name ASC
      `,
      [req.user]
    );

    res.json(q.rows);
  } catch {
    res.status(500).json({ error: "Неуспешно зареждане на известията" });
  }
};

const getAlertStatus = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    const q = await pool.query(
      `
        SELECT is_active, is_favorite, notification_frequency
        FROM lake_subscriptions
        WHERE user_id = $1 AND water_body_id = $2
      `,
      [req.user, waterBodyId]
    );

    if (!q.rows.length) {
      const prefQ = await pool.query(
        `
          SELECT email_alerts_enabled, default_notification_frequency
          FROM user_notification_preferences
          WHERE user_id = $1
        `,
        [req.user]
      );

      const pref = prefQ.rows[0];

      return res.json({
        enabled: false,
        favorite: false,
        notification_frequency: pref?.default_notification_frequency || "daily",
        email_alerts_enabled: pref ? Boolean(pref.email_alerts_enabled) : true,
      });
    }

    const prefQ = await pool.query(
      `
        SELECT email_alerts_enabled
        FROM user_notification_preferences
        WHERE user_id = $1
      `,
      [req.user]
    );

    return res.json({
      enabled: Boolean(q.rows[0].is_active),
      favorite: Boolean(q.rows[0].is_favorite),
      notification_frequency: q.rows[0].notification_frequency || "daily",
      email_alerts_enabled: prefQ.rows.length
        ? Boolean(prefQ.rows[0].email_alerts_enabled)
        : true,
    });
  } catch {
    res.status(500).json({ error: "Неуспешно зареждане на статуса на известието" });
  }
};

const createAlert = async (req, res) => {
  try {
    const {
      water_body_id,
      is_favorite = true,
      notification_frequency,
    } = req.body;

    if (!water_body_id) {
      return res.status(400).json({ error: "water_body_id is required" });
    }

    const prefQ = await pool.query(
      `
        SELECT email_alerts_enabled, default_notification_frequency
        FROM user_notification_preferences
        WHERE user_id = $1
      `,
      [req.user]
    );

    const pref = prefQ.rows[0] || {
      email_alerts_enabled: true,
      default_notification_frequency: "daily",
    };

    const finalFrequency =
      notification_frequency || pref.default_notification_frequency || "daily";
    if (!["daily", "weekly"].includes(finalFrequency)) {
      return res.status(400).json({ error: "notification_frequency must be daily or weekly" });
    }


    const q = await pool.query(
      `
        INSERT INTO lake_subscriptions (
          user_id,
          water_body_id,
          is_active,
          is_favorite,
          notification_frequency
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, water_body_id) DO UPDATE
        SET
          is_active = EXCLUDED.is_active,
          is_favorite = EXCLUDED.is_favorite,
          notification_frequency = EXCLUDED.notification_frequency
        RETURNING id, user_id, water_body_id, is_active, is_favorite, notification_frequency, created_at
      `,
      [
        req.user,
        water_body_id,
        Boolean(pref.email_alerts_enabled),
        Boolean(is_favorite),
        finalFrequency,
      ]
    );

    res.json(q.rows[0]);
  } catch {
    res.status(500).json({ error: "Неуспешно включване на известието" });
  }
};

const updateAlert = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const { is_active, is_favorite, notification_frequency } = req.body;

    const existing = await pool.query(
      `
        SELECT *
        FROM lake_subscriptions
        WHERE user_id = $1 AND water_body_id = $2
      `,
      [req.user, waterBodyId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Alert settings not found" });
    }

    const prefQ = await pool.query(
      `
        SELECT email_alerts_enabled
        FROM user_notification_preferences
        WHERE user_id = $1
      `,
      [req.user]
    );

    const emailAlertsEnabled = prefQ.rows.length
      ? Boolean(prefQ.rows[0].email_alerts_enabled)
      : true;

    const current = existing.rows[0];

    const nextIsActive =
      typeof is_active === "boolean"
        ? is_active && emailAlertsEnabled
        : Boolean(current.is_active) && emailAlertsEnabled;

    const nextIsFavorite =
      typeof is_favorite === "boolean" ? is_favorite : current.is_favorite;

    const nextFrequency = notification_frequency || current.notification_frequency;
    if (!["daily", "weekly"].includes(nextFrequency)) {
      return res.status(400).json({ error: "notification_frequency must be daily or weekly" });
    }


    const q = await pool.query(
      `
        UPDATE lake_subscriptions
        SET
          is_active = $3,
          is_favorite = $4,
          notification_frequency = $5
        WHERE user_id = $1 AND water_body_id = $2
        RETURNING id, user_id, water_body_id, is_active, is_favorite, notification_frequency, created_at
      `,
      [req.user, waterBodyId, nextIsActive, nextIsFavorite, nextFrequency]
    );

    res.json(q.rows[0]);
  } catch {
    res.status(500).json({ error: "Неуспешно обновяване на настройките за известия" });
  }
};

const deleteAlert = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    await pool.query(
      `
        UPDATE lake_subscriptions
        SET is_active = FALSE
        WHERE user_id = $1 AND water_body_id = $2
      `,
      [req.user, waterBodyId]
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Неуспешно изключване на известието" });
  }
};

const getFavorites = async (req, res) => {
  try {
    const q = await pool.query(
      `
        SELECT
          s.id,
          s.water_body_id,
          s.is_active,
          s.is_favorite,
          s.notification_frequency,
          s.created_at,
          w.name AS lake_name
        FROM lake_subscriptions s
        JOIN water_bodies w ON w.id = s.water_body_id
        WHERE s.user_id = $1 AND s.is_favorite = TRUE
        ORDER BY w.name ASC
      `,
      [req.user]
    );

    res.json(q.rows);
  } catch {
    res.status(500).json({ error: "Неуспешно зареждане на любимите" });
  }
};

const createFavorite = async (req, res) => {
  try {
    const { water_body_id } = req.body;

    if (!water_body_id) {
      return res.status(400).json({ error: "water_body_id is required" });
    }

    const prefQ = await pool.query(
      `
        SELECT default_notification_frequency, email_alerts_enabled
        FROM user_notification_preferences
        WHERE user_id = $1
      `,
      [req.user]
    );

    const pref = prefQ.rows[0] || {
      default_notification_frequency: "daily",
      email_alerts_enabled: true,
    };

    const q = await pool.query(
      `
        INSERT INTO lake_subscriptions (
          user_id,
          water_body_id,
          is_active,
          is_favorite,
          notification_frequency
        )
        VALUES ($1, $2, $3, TRUE, $4)
        ON CONFLICT (user_id, water_body_id) DO UPDATE
        SET
          is_favorite = TRUE,
          notification_frequency = COALESCE(lake_subscriptions.notification_frequency, EXCLUDED.notification_frequency)
        RETURNING id, user_id, water_body_id, is_active, is_favorite, notification_frequency, created_at
      `,
      [
        req.user,
        water_body_id,
        false,
        pref.default_notification_frequency || "daily",
      ]
    );

    res.json(q.rows[0]);
  } catch {
    res.status(500).json({ error: "Неуспешно добавяне на водоема в любими" });
  }
};

const deleteFavorite = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    await pool.query(
      `
        UPDATE lake_subscriptions
        SET is_favorite = FALSE
        WHERE user_id = $1 AND water_body_id = $2
      `,
      [req.user, waterBodyId]
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Неуспешно премахване от любими" });
  }
};

module.exports = {
  getAlerts,
  getAlertStatus,
  createAlert,
  updateAlert,
  deleteAlert,
  getFavorites,
  createFavorite,
  deleteFavorite,
};