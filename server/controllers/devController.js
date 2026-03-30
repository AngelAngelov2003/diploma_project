const pool = require("../db");
const {
  runDailyAlertEmails,
  runWeeklyAlertEmails,
} = require("../services/alertService");
const { getMostRecentScheduledWeeklyDate } = require("../utils/time");

const runAlertsNow = async (req, res) => {
  try {
    const frequency = String(req.query.frequency || req.body?.frequency || "")
      .trim()
      .toLowerCase();

    let result;

    if (frequency === "weekly") {
      result = await runWeeklyAlertEmails({
        force: true,
        deliveryDate: getMostRecentScheduledWeeklyDate(),
      });
    } else if (frequency === "daily") {
      result = await runDailyAlertEmails({
        force: true,
      });
    } else {
      const daily = await runDailyAlertEmails({
        force: true,
      });

      const weekly = await runWeeklyAlertEmails({
        force: true,
        deliveryDate: getMostRecentScheduledWeeklyDate(),
      });

      result = { ok: true, daily, weekly };
    }

    res.json(result);
  } catch (err) {
    console.error("runAlertsNow failed:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
};

const getMlTrainingData = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.temperature AS temp,
        c.pressure,
        c.wind_speed,
        COALESCE(ST_Y(ST_Centroid(w.geom)), w.lat) AS lat,
        COALESCE(ST_X(ST_Centroid(w.geom)), w.lng) AS lng,
        c.catch_time,
        c.created_at
      FROM catch_logs c
      JOIN water_bodies w ON w.id = c.water_body_id
      WHERE c.temperature IS NOT NULL
        AND c.pressure IS NOT NULL
        AND c.wind_speed IS NOT NULL
        AND (
          w.geom IS NOT NULL
          OR (w.lat IS NOT NULL AND w.lng IS NOT NULL)
        )
      ORDER BY COALESCE(c.catch_time, c.created_at) DESC
      LIMIT 5000
    `);

    res.json(rows);
  } catch (err) {
    console.error("getMlTrainingData failed:", err);
    res.status(500).json({ error: "Failed to load ML training data" });
  }
};

module.exports = {
  runAlertsNow,
  getMlTrainingData,
};