const pool = require("../db");

let reservationSchemaEnsured = false;

const ensureReservationSchema = async () => {
  if (reservationSchemaEnsured) {
    return;
  }

  await pool.query(`
    ALTER TABLE lake_reservations
    ADD COLUMN IF NOT EXISTS people_count INTEGER NOT NULL DEFAULT 1
  `);

  reservationSchemaEnsured = true;
};

const getMyReservations = async (req, res) => {
  try {
    await ensureReservationSchema();
    const q = await pool.query(
      `
        SELECT
          r.id,
          r.water_body_id,
          r.user_id,
          r.reservation_date,
          r.notes,
          r.people_count,
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
      [req.user]
    );

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load reservations" });
  }
};

const getIncomingReservations = async (req, res) => {
  try {
    await ensureReservationSchema();
    const q = await pool.query(
      `
        SELECT
          r.id,
          r.water_body_id,
          r.user_id,
          r.reservation_date,
          r.notes,
          r.people_count,
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
      [req.user]
    );

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load incoming reservations" });
  }
};

const getMyReservationStatus = async (req, res) => {
  try {
    await ensureReservationSchema();
    const { waterBodyId } = req.params;

    const lakeQ = await pool.query(
      `
        SELECT id, is_private
        FROM water_bodies
        WHERE id = $1
      `,
      [waterBodyId]
    );

    if (!lakeQ.rows.length) {
      return res.status(404).json({ error: "Lake not found" });
    }

    if (!lakeQ.rows[0].is_private) {
      return res.json({ is_private: false, reservation: null });
    }

    const reservationQ = await pool.query(
      `
        SELECT id, water_body_id, user_id, reservation_date, notes, people_count, status, created_at, updated_at
        FROM lake_reservations
        WHERE water_body_id = $1 AND user_id = $2
        ORDER BY reservation_date DESC, created_at DESC
        LIMIT 1
      `,
      [waterBodyId, req.user]
    );

    res.json({
      is_private: true,
      reservation: reservationQ.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load reservation status" });
  }
};

const createReservation = async (req, res) => {
  try {
    await ensureReservationSchema();
    const { water_body_id, reservation_date, notes, people_count } = req.body;

    if (!water_body_id || !reservation_date) {
      return res.status(400).json({ error: "water_body_id and reservation_date are required" });
    }

    const lakeQ = await pool.query(
      `
        SELECT id, name, is_private, owner_id, is_reservable, capacity
        FROM water_bodies
        WHERE id = $1
      `,
      [water_body_id]
    );

    if (!lakeQ.rows.length) {
      return res.status(404).json({ error: "Lake not found" });
    }

    const lake = lakeQ.rows[0];
    const normalizedPeopleCount = Number(people_count || 1);

    if (!Number.isInteger(normalizedPeopleCount) || normalizedPeopleCount < 1) {
      return res.status(400).json({ error: "People count must be at least 1" });
    }

    if (!lake.is_private) {
      return res.status(400).json({ error: "Reservations are only allowed for private lakes" });
    }

    if (!lake.is_reservable) {
      return res.status(400).json({ error: "Reservations are currently disabled for this lake" });
    }

    if (String(lake.owner_id) === String(req.user)) {
      return res.status(400).json({ error: "Owner cannot reserve own lake" });
    }

    const blockedQ = await pool.query(
      `
        SELECT 1
        FROM lake_blocked_dates
        WHERE water_body_id = $1 AND blocked_date = $2
        LIMIT 1
      `,
      [water_body_id, reservation_date]
    );

    if (blockedQ.rows.length) {
      return res.status(400).json({ error: "This date is blocked by the lake owner" });
    }

    const approvedCountQ = await pool.query(
      `
        SELECT COALESCE(SUM(people_count), 0)::int AS count
        FROM lake_reservations
        WHERE water_body_id = $1 AND reservation_date = $2 AND status = 'approved'
      `,
      [water_body_id, reservation_date]
    );

    const approvedCount = Number(approvedCountQ.rows[0]?.count || 0);
    const lakeCapacity = Math.max(1, Number(lake.capacity || 1));

    if (normalizedPeopleCount > lakeCapacity) {
      return res.status(400).json({ error: `This lake accepts up to ${lakeCapacity} people per request` });
    }

    if (approvedCount + normalizedPeopleCount > lakeCapacity) {
      return res.status(400).json({ error: "No remaining capacity for this date" });
    }

    const q = await pool.query(
      `
        INSERT INTO lake_reservations (
          water_body_id,
          user_id,
          reservation_date,
          notes,
          people_count,
          status,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
        ON CONFLICT (water_body_id, user_id, reservation_date) DO UPDATE
        SET
          notes = EXCLUDED.notes,
          people_count = EXCLUDED.people_count,
          status = 'pending',
          updated_at = NOW()
        RETURNING *
      `,
      [
        water_body_id,
        req.user,
        reservation_date,
        String(notes || "").trim() || null,
        normalizedPeopleCount,
      ]
    );

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create reservation" });
  }
};

const cancelReservation = async (req, res) => {
  try {
    await ensureReservationSchema();
    const { reservationId } = req.params;

    const existing = await pool.query(
      `
        SELECT *
        FROM lake_reservations
        WHERE id = $1 AND user_id = $2
      `,
      [reservationId, req.user]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    const q = await pool.query(
      `
        UPDATE lake_reservations
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `,
      [reservationId, req.user]
    );

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel reservation" });
  }
};

const updateReservationStatus = async (req, res) => {
  try {
    await ensureReservationSchema();
    const { reservationId } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid reservation status" });
    }

    const existing = await pool.query(
      `
        SELECT
          r.id,
          r.water_body_id,
          r.user_id,
          r.status,
          r.reservation_date,
          r.people_count,
          w.owner_id,
          w.is_private,
          w.capacity
        FROM lake_reservations r
        JOIN water_bodies w ON w.id = r.water_body_id
        WHERE r.id = $1
      `,
      [reservationId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    const reservation = existing.rows[0];

    if (!reservation.is_private || String(reservation.owner_id) !== String(req.user)) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const blockedQ = await pool.query(
      `
        SELECT 1
        FROM lake_blocked_dates
        WHERE water_body_id = $1 AND blocked_date = $2
        LIMIT 1
      `,
      [reservation.water_body_id, reservation.reservation_date]
    );

    if (blockedQ.rows.length && status === "approved") {
      return res.status(400).json({ error: "This date is blocked by the owner" });
    }

    if (status === "approved") {
      const approvedCountQ = await pool.query(
        `
          SELECT COALESCE(SUM(people_count), 0)::int AS count
          FROM lake_reservations
          WHERE water_body_id = $1
            AND reservation_date = $2
            AND status = 'approved'
            AND id <> $3
        `,
        [reservation.water_body_id, reservation.reservation_date, reservationId]
      );

      const approvedCount = Number(approvedCountQ.rows[0]?.count || 0);
      const requestedPeopleCount = Number(reservation.people_count || 1);

      if (approvedCount + requestedPeopleCount > Number(reservation.capacity || 1)) {
        return res.status(400).json({ error: "Capacity reached for this date" });
      }
    }

    const q = await pool.query(
      `
        UPDATE lake_reservations
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [reservationId, status]
    );

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update reservation status" });
  }
};

module.exports = {
  getMyReservations,
  getIncomingReservations,
  getMyReservationStatus,
  createReservation,
  cancelReservation,
  updateReservationStatus,
};