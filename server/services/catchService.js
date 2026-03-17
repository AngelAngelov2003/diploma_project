const pool = require("../db");

const createCatchLog = async ({
  userId,
  waterBodyId,
  species,
  weightKg,
  imageUrl,
  catchTime,
  temperature,
  pressure,
  windSpeed,
  humidity,
  moonPhase,
  notes,
}) => {
  const q = await pool.query(
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
      userId,
      waterBodyId,
      species,
      weightKg,
      imageUrl,
      catchTime,
      temperature,
      pressure,
      windSpeed,
      humidity,
      moonPhase,
      notes,
    ]
  );

  return q.rows[0];
};

const getUserCatches = async (userId) => {
  const q = await pool.query(
    `
      SELECT catch_logs.*, water_bodies.name AS lake_name
      FROM catch_logs
      JOIN water_bodies ON catch_logs.water_body_id = water_bodies.id
      WHERE user_id = $1
      ORDER BY COALESCE(catch_logs.catch_time, catch_logs.created_at) DESC, catch_logs.created_at DESC
    `,
    [userId]
  );

  return q.rows;
};

const getCatchByIdForUser = async (catchId, userId) => {
  const q = await pool.query(
    `
      SELECT c.*, w.name AS lake_name
      FROM catch_logs c
      JOIN water_bodies w ON w.id = c.water_body_id
      WHERE c.id = $1 AND c.user_id = $2
    `,
    [catchId, userId]
  );

  return q.rows[0] || null;
};

const getRawCatchByIdForUser = async (catchId, userId) => {
  const q = await pool.query(
    `
      SELECT *
      FROM catch_logs
      WHERE id = $1 AND user_id = $2
    `,
    [catchId, userId]
  );

  return q.rows[0] || null;
};

const updateCatchLog = async ({
  catchId,
  userId,
  waterBodyId,
  species,
  weightKg,
  imageUrl,
  catchTime,
  temperature,
  pressure,
  windSpeed,
  humidity,
  moonPhase,
  notes,
}) => {
  const q = await pool.query(
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
      RETURNING *
    `,
    [
      catchId,
      userId,
      waterBodyId,
      species,
      weightKg,
      imageUrl,
      catchTime,
      temperature,
      pressure,
      windSpeed,
      humidity,
      moonPhase,
      notes,
    ]
  );

  return q.rows[0] || null;
};

const deleteCatchLog = async (catchId, userId) => {
  await pool.query(
    `
      DELETE FROM catch_logs
      WHERE id = $1 AND user_id = $2
    `,
    [catchId, userId]
  );

  return true;
};

module.exports = {
  createCatchLog,
  getUserCatches,
  getCatchByIdForUser,
  getRawCatchByIdForUser,
  updateCatchLog,
  deleteCatchLog,
};