const pool = require("../db");
const { parseCatchPayload } = require("../utils/validation");

const createCatch = async (req, res) => {
  try {
    const {
      water_body_id,
      species,
      weight_kg,
      catch_time,
      temperature,
      pressure,
      wind_speed,
      humidity,
      moon_phase,
      notes,
    } = parseCatchPayload(req.body);

    if (!water_body_id) {
      return res.status(400).json({ error: "water_body_id is required" });
    }

    if (!species) {
      return res.status(400).json({ error: "species is required" });
    }

    const image_url = req.file ? req.file.filename : null;

    const newCatch = await pool.query(
      `
        INSERT INTO catch_logs (
          user_id,
          water_body_id,
          species,
          weight_kg,
          image_url,
          catch_time,
          temperature,
          pressure,
          wind_speed,
          humidity,
          moon_phase,
          notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      `,
      [
        req.user,
        water_body_id,
        species,
        weight_kg,
        image_url,
        catch_time,
        temperature,
        pressure,
        wind_speed,
        humidity,
        moon_phase,
        notes,
      ]
    );

    res.json(newCatch.rows[0]);
  } catch (err) {
    res.status(500).send("Server Error: " + err.message);
  }
};

const getMyCatches = async (req, res) => {
  try {
    const myCatches = await pool.query(
      `
        SELECT catch_logs.*, water_bodies.name AS lake_name
        FROM catch_logs
        JOIN water_bodies ON catch_logs.water_body_id = water_bodies.id
        WHERE user_id = $1
        ORDER BY COALESCE(catch_logs.catch_time, catch_logs.created_at) DESC, catch_logs.created_at DESC
      `,
      [req.user]
    );

    res.json(myCatches.rows);
  } catch {
    res.status(500).send("Server Error");
  }
};

const getMyCatchAnalytics = async (req, res) => {
  try {
    const [
      totalsQ,
      topSpeciesQ,
      topLakesQ,
      bestMonthQ,
      biggestCatchQ,
      recentCatchesQ,
    ] = await Promise.all([
      pool.query(
        `
          SELECT
            COUNT(*)::int AS total_catches,
            COUNT(DISTINCT water_body_id)::int AS unique_lakes,
            ROUND(COALESCE(AVG(weight_kg), 0)::numeric, 2) AS avg_weight_kg,
            ROUND(COALESCE(SUM(weight_kg), 0)::numeric, 2) AS total_weight_kg
          FROM catch_logs
          WHERE user_id = $1
        `,
        [req.user]
      ),
      pool.query(
        `
          SELECT
            species,
            COUNT(*)::int AS catches_count,
            ROUND(COALESCE(AVG(weight_kg), 0)::numeric, 2) AS avg_weight_kg,
            ROUND(COALESCE(MAX(weight_kg), 0)::numeric, 2) AS max_weight_kg
          FROM catch_logs
          WHERE user_id = $1
            AND species IS NOT NULL
            AND TRIM(species) <> ''
          GROUP BY species
          ORDER BY catches_count DESC, species ASC
          LIMIT 5
        `,
        [req.user]
      ),
      pool.query(
        `
          SELECT
            w.id AS water_body_id,
            w.name AS lake_name,
            COUNT(c.id)::int AS catches_count,
            ROUND(COALESCE(AVG(c.weight_kg), 0)::numeric, 2) AS avg_weight_kg,
            ROUND(COALESCE(MAX(c.weight_kg), 0)::numeric, 2) AS max_weight_kg
          FROM catch_logs c
          JOIN water_bodies w ON w.id = c.water_body_id
          WHERE c.user_id = $1
          GROUP BY w.id, w.name
          ORDER BY catches_count DESC, w.name ASC
          LIMIT 5
        `,
        [req.user]
      ),
      pool.query(
        `
          SELECT
            TO_CHAR(DATE_TRUNC('month', COALESCE(catch_time, created_at)), 'YYYY-MM') AS month_key,
            TO_CHAR(DATE_TRUNC('month', COALESCE(catch_time, created_at)), 'Mon YYYY') AS month_label,
            COUNT(*)::int AS catches_count
          FROM catch_logs
          WHERE user_id = $1
          GROUP BY DATE_TRUNC('month', COALESCE(catch_time, created_at))
          ORDER BY catches_count DESC, month_key ASC
          LIMIT 1
        `,
        [req.user]
      ),
      pool.query(
        `
          SELECT c.*, w.name AS lake_name
          FROM catch_logs c
          JOIN water_bodies w ON w.id = c.water_body_id
          WHERE c.user_id = $1
          ORDER BY c.weight_kg DESC NULLS LAST, COALESCE(c.catch_time, c.created_at) DESC
          LIMIT 1
        `,
        [req.user]
      ),
      pool.query(
        `
          SELECT c.*, w.name AS lake_name
          FROM catch_logs c
          JOIN water_bodies w ON w.id = c.water_body_id
          WHERE c.user_id = $1
          ORDER BY COALESCE(c.catch_time, c.created_at) DESC, c.created_at DESC
          LIMIT 5
        `,
        [req.user]
      ),
    ]);

    res.json({
      totals: totalsQ.rows[0] || {
        total_catches: 0,
        unique_lakes: 0,
        avg_weight_kg: 0,
        total_weight_kg: 0,
      },
      topSpecies: topSpeciesQ.rows,
      topLakes: topLakesQ.rows,
      bestMonth: bestMonthQ.rows[0] || null,
      biggestCatch: biggestCatchQ.rows[0] || null,
      recentCatches: recentCatchesQ.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load catch analytics" });
  }
};

const getCatchById = async (req, res) => {
  try {
    const { catchId } = req.params;

    const q = await pool.query(
      `
        SELECT c.*, w.name AS lake_name
        FROM catch_logs c
        JOIN water_bodies w ON w.id = c.water_body_id
        WHERE c.id = $1 AND c.user_id = $2
      `,
      [catchId, req.user]
    );

    if (!q.rows.length) {
      return res.status(404).json({ error: "Catch not found" });
    }

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to load catch" });
  }
};

const updateCatch = async (req, res) => {
  try {
    const { catchId } = req.params;

    const existingQ = await pool.query(
      `
        SELECT *
        FROM catch_logs
        WHERE id = $1 AND user_id = $2
      `,
      [catchId, req.user]
    );

    if (!existingQ.rows.length) {
      return res.status(404).json({ error: "Catch not found" });
    }

    const current = existingQ.rows[0];
    const payload = parseCatchPayload(req.body);

    const nextWaterBodyId =
      req.body.water_body_id !== undefined ? payload.water_body_id : current.water_body_id;
    const nextSpecies =
      req.body.species !== undefined ? payload.species : current.species;
    const nextWeight =
      req.body.weight_kg !== undefined ? payload.weight_kg : current.weight_kg;
    const nextCatchTime =
      req.body.catch_time !== undefined ? payload.catch_time : current.catch_time;
    const nextTemperature =
      req.body.temperature !== undefined ? payload.temperature : current.temperature;
    const nextPressure =
      req.body.pressure !== undefined ? payload.pressure : current.pressure;
    const nextWindSpeed =
      req.body.wind_speed !== undefined ? payload.wind_speed : current.wind_speed;
    const nextHumidity =
      req.body.humidity !== undefined ? payload.humidity : current.humidity;
    const nextMoonPhase =
      req.body.moon_phase !== undefined ? payload.moon_phase : current.moon_phase;
    const nextNotes =
      req.body.notes !== undefined ? payload.notes : current.notes;
    const nextImageUrl = req.file ? req.file.filename : current.image_url;

    if (!nextWaterBodyId) {
      return res.status(400).json({ error: "water_body_id is required" });
    }

    if (!nextSpecies) {
      return res.status(400).json({ error: "species is required" });
    }

    await pool.query(
      `
        UPDATE catch_logs
        SET
          water_body_id = $3,
          species = $4,
          weight_kg = $5,
          image_url = $6,
          catch_time = $7,
          temperature = $8,
          pressure = $9,
          wind_speed = $10,
          humidity = $11,
          moon_phase = $12,
          notes = $13
        WHERE id = $1 AND user_id = $2
      `,
      [
        catchId,
        req.user,
        nextWaterBodyId,
        nextSpecies,
        nextWeight,
        nextImageUrl,
        nextCatchTime,
        nextTemperature,
        nextPressure,
        nextWindSpeed,
        nextHumidity,
        nextMoonPhase,
        nextNotes,
      ]
    );

    const resultQ = await pool.query(
      `
        SELECT c.*, w.name AS lake_name
        FROM catch_logs c
        JOIN water_bodies w ON w.id = c.water_body_id
        WHERE c.id = $1 AND c.user_id = $2
      `,
      [catchId, req.user]
    );

    res.json(resultQ.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update catch" });
  }
};

const deleteCatch = async (req, res) => {
  try {
    const { catchId } = req.params;

    const existingQ = await pool.query(
      `
        SELECT id
        FROM catch_logs
        WHERE id = $1 AND user_id = $2
      `,
      [catchId, req.user]
    );

    if (!existingQ.rows.length) {
      return res.status(404).json({ error: "Catch not found" });
    }

    await pool.query(
      `
        DELETE FROM catch_logs
        WHERE id = $1 AND user_id = $2
      `,
      [catchId, req.user]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete catch" });
  }
};

module.exports = {
  createCatch,
  getMyCatches,
  getMyCatchAnalytics,
  getCatchById,
  updateCatch,
  deleteCatch,
};