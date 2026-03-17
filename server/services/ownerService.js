const pool = require("../db");

const getLakesOwnedByUser = async (userId) => {
  const q = await pool.query(
    `
      SELECT
        id,
        name,
        description,
        type,
        is_private,
        owner_id,
        price_per_day,
        capacity,
        is_reservable,
        availability_notes,
        created_at,
        updated_at
      FROM water_bodies
      WHERE owner_id = $1
      ORDER BY name ASC
    `,
    [userId]
  );

  return q.rows;
};

const getClaimableLakes = async () => {
  const q = await pool.query(`
    SELECT
      w.id,
      w.name,
      w.description,
      w.type,
      w.is_private,
      w.owner_id,
      w.price_per_day,
      w.capacity,
      w.is_reservable,
      w.availability_notes,
      w.created_at,
      w.updated_at
    FROM water_bodies w
    WHERE w.is_private = TRUE AND w.owner_id IS NULL
    ORDER BY w.name ASC
  `);

  return q.rows;
};

const getClaimRequestsForUser = async (userId) => {
  const q = await pool.query(
    `
      SELECT
        r.id,
        r.water_body_id,
        r.user_id,
        r.full_name,
        r.email,
        r.phone,
        r.company_name,
        r.message,
        r.proof_document_url,
        r.status,
        r.admin_note,
        r.reviewed_by,
        r.reviewed_at,
        r.created_at,
        r.updated_at,
        w.name AS lake_name
      FROM lake_owner_claim_requests r
      JOIN water_bodies w ON w.id = r.water_body_id
      WHERE r.user_id = $1
      ORDER BY
        CASE r.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
          ELSE 4
        END,
        r.created_at DESC
    `,
    [userId]
  );

  return q.rows;
};

module.exports = {
  getLakesOwnedByUser,
  getClaimableLakes,
  getClaimRequestsForUser,
};