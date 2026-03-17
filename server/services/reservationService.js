const pool = require("../db");

const getUserReservations = async (userId) => {
  const q = await pool.query(
    `
      SELECT
        r.id,
        r.water_body_id,
        r.user_id,
        r.reservation_date,
        r.notes,
        r.status,
        r.created_at,
        r.updated_at,
        w.name AS lake_name,
        w.is_private
      FROM lake_reservations r
      JOIN water_bodies w ON w.id = r.water_body_id
      WHERE r.user_id = $1
      ORDER BY r.reservation_date DESC, r.created_at DESC
    `,
    [userId]
  );

  return q.rows;
};

const getIncomingReservationsForOwner = async (ownerId) => {
  const q = await pool.query(
    `
      SELECT
        r.id,
        r.water_body_id,
        r.user_id,
        r.reservation_date,
        r.notes,
        r.status,
        r.created_at,
        r.updated_at,
        w.name AS lake_name,
        u.full_name,
        u.email
      FROM lake_reservations r
      JOIN water_bodies w ON w.id = r.water_body_id
      JOIN users u ON u.id = r.user_id
      WHERE w.owner_id = $1 AND w.is_private = TRUE
      ORDER BY
        CASE r.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
          WHEN 'cancelled' THEN 4
          ELSE 5
        END,
        r.reservation_date ASC,
        r.created_at DESC
    `,
    [ownerId]
  );

  return q.rows;
};

module.exports = {
  getUserReservations,
  getIncomingReservationsForOwner,
};