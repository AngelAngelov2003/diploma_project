const pool = require("../db");
const { refreshWaterBodyMaterializedViews } = require("../services/materializedViewService");
const { ensureReservationDomainTables } = require("../setup/ensureTables");

let schemaEnsured = false;
const ensureSchema = async () => {
  if (!schemaEnsured) {
    await ensureReservationDomainTables();
    schemaEnsured = true;
  }
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ensureOwnedLake = async (waterBodyId, userId) => {
  const q = await pool.query(`SELECT * FROM water_bodies WHERE id = $1 AND owner_id = $2 LIMIT 1`, [waterBodyId, userId]);
  return q.rows[0] || null;
};

const getOwnerLakes = async (req, res) => {
  try {
    await ensureSchema();
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
        w.spots_count,
        w.is_reservable,
        w.allows_night_fishing,
        w.night_fishing_price,
        w.has_housing,
        w.created_at,
        w.updated_at,
        COALESCE((SELECT COUNT(*)::int FROM lake_spots s WHERE s.water_body_id = w.id AND s.is_active = TRUE), 0) AS active_spots_count,
        COALESCE((SELECT COUNT(*)::int FROM lake_rooms r WHERE r.water_body_id = w.id AND r.is_active = TRUE), 0) AS active_rooms_count,
        COALESCE((SELECT COUNT(*)::int FROM lake_gallery_photos p WHERE p.water_body_id = w.id), 0) AS photos_count
      FROM water_bodies w
      WHERE w.owner_id = $1
      ORDER BY w.name ASC
    `, [req.user]);
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load owner lakes' });
  }
};

const getMyClaimRequests = async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT r.*, w.name AS lake_name
      FROM lake_owner_claim_requests r
      JOIN water_bodies w ON w.id = r.water_body_id
      WHERE r.user_id = $1
      ORDER BY CASE r.status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 WHEN 'rejected' THEN 3 ELSE 4 END, r.created_at DESC
    `, [req.user]);
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load claim requests' });
  }
};

const createClaimRequest = async (req, res) => {
  try {
    const { water_body_id, full_name, email, phone, company_name, message } = req.body;
    const waterBodyId = String(water_body_id || '').trim();
    const nextFullName = String(full_name || '').trim();
    const nextEmail = String(email || '').trim().toLowerCase();
    const nextPhone = String(phone || '').trim() || null;
    const nextCompanyName = String(company_name || '').trim() || null;
    const nextMessage = String(message || '').trim() || null;
    const proofDocumentUrl = req.file ? req.file.filename : null;
    if (!waterBodyId) return res.status(400).json({ error: 'water_body_id is required' });
    if (!nextFullName) return res.status(400).json({ error: 'full_name is required' });
    if (!nextEmail) return res.status(400).json({ error: 'email is required' });
    if (!proofDocumentUrl) return res.status(400).json({ error: 'proof_document is required' });
    const lakeQ = await pool.query(`SELECT id, name, is_private, is_reservable, owner_id FROM water_bodies WHERE id = $1`, [waterBodyId]);
    if (!lakeQ.rows.length) return res.status(404).json({ error: 'Водоемът не е намерен' });
    const lake = lakeQ.rows[0];
    if (!lake.is_private || !lake.is_reservable) return res.status(400).json({ error: 'Only private, reservable lakes can be requested' });
    if (lake.owner_id) return res.status(400).json({ error: 'This lake already has an owner' });
    const existingPendingQ = await pool.query(`SELECT id FROM lake_owner_claim_requests WHERE water_body_id = $1 AND user_id = $2 AND status = 'pending' LIMIT 1`, [waterBodyId, req.user]);
    if (existingPendingQ.rows.length) return res.status(400).json({ error: 'You already have a pending request for this lake' });
    const q = await pool.query(`
      INSERT INTO lake_owner_claim_requests (water_body_id, user_id, full_name, email, phone, company_name, message, proof_document_url, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())
      RETURNING *
    `, [waterBodyId, req.user, nextFullName, nextEmail, nextPhone, nextCompanyName, nextMessage, proofDocumentUrl]);
    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to submit claim request' });
  }
};

const updateOwnerLake = async (req, res) => {
  try {
    await ensureSchema();
    const { waterBodyId } = req.params;
    const current = await ensureOwnedLake(waterBodyId, req.user);
    if (!current) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    const nextName = String(req.body.name ?? current.name ?? '').trim();
    const nextDescription = String(req.body.description ?? current.description ?? '').trim() || null;
    const nextType = String(current.type ?? '').trim() || null;
    let nextIsPrivate = typeof req.body.is_private === 'boolean' ? req.body.is_private : Boolean(current.is_private);
    let nextIsReservable = typeof req.body.is_reservable === 'boolean' ? req.body.is_reservable : Boolean(current.is_reservable);
    const nextPricePerDay = req.body.price_per_day !== undefined ? Number(req.body.price_per_day) : Number(current.price_per_day || 0);
    const nextCapacity = req.body.capacity !== undefined ? Number(req.body.capacity) : Number(current.capacity || 1);
    const nextSpotsCount = req.body.spots_count !== undefined ? Number(req.body.spots_count) : Number(current.spots_count || 0);
    const nextAllowsNightFishing = typeof req.body.allows_night_fishing === 'boolean' ? req.body.allows_night_fishing : Boolean(current.allows_night_fishing);
    const nextNightFishingPrice = req.body.night_fishing_price !== undefined ? Number(req.body.night_fishing_price) : Number(current.night_fishing_price || 0);
    const nextHasHousing = typeof req.body.has_housing === 'boolean' ? req.body.has_housing : Boolean(current.has_housing);
    if (nextIsReservable) nextIsPrivate = true;
    if (!nextIsPrivate) nextIsReservable = false;
    if (!nextName) return res.status(400).json({ error: 'Името на водоема е задължително' });
    if (!Number.isFinite(nextPricePerDay) || nextPricePerDay < 0) return res.status(400).json({ error: 'price_per_day must be 0 or greater' });
    if (!Number.isInteger(nextCapacity) || nextCapacity < 1) return res.status(400).json({ error: 'capacity must be an integer greater than 0' });
    if (!Number.isInteger(nextSpotsCount) || nextSpotsCount < 0) return res.status(400).json({ error: 'spots_count must be 0 or greater' });
    if (!Number.isFinite(nextNightFishingPrice) || nextNightFishingPrice < 0) return res.status(400).json({ error: 'night_fishing_price must be 0 or greater' });
    const q = await pool.query(`
      UPDATE water_bodies
      SET name = $3, description = $4, type = $5, is_private = $6, price_per_day = $7, capacity = $8, spots_count = $9, is_reservable = $10, allows_night_fishing = $11, night_fishing_price = $12, has_housing = $13, updated_at = NOW()
      WHERE id = $1 AND owner_id = $2
      RETURNING id, name, description, type, is_private, owner_id, price_per_day, capacity, spots_count, is_reservable, allows_night_fishing, night_fishing_price, has_housing, created_at, updated_at
    `, [waterBodyId, req.user, nextName, nextDescription, nextType, nextIsPrivate, nextPricePerDay, nextCapacity, nextSpotsCount, nextIsReservable, nextAllowsNightFishing, nextNightFishingPrice, nextHasHousing]);
    await refreshWaterBodyMaterializedViews();
    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update owner lake' });
  }
};


const formatDateParam = (value) => String(value || '').trim().slice(0, 10);

const getOwnerLakeReservations = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });

    const q = await pool.query(`
      SELECT
        r.id,
        r.water_body_id,
        r.user_id,
        COALESCE(r.start_date, r.reservation_date) AS arrival_date,
        COALESCE(r.end_date, r.start_date, r.reservation_date) AS departure_date,
        r.reservation_date,
        r.notes,
        COALESCE(r.requested_spots, r.people_count, 1) AS requested_spots,
        r.people_count,
        r.includes_night_fishing,
        r.wants_housing,
        r.base_amount,
        r.night_fishing_amount,
        r.rooms_amount,
        r.total_amount,
        CASE
          WHEN EXISTS (SELECT 1 FROM reservation_payments rp WHERE rp.reservation_id = r.id AND rp.status = 'paid') THEN 'paid'
          ELSE r.payment_status
        END AS payment_status,
        CASE
          WHEN EXISTS (SELECT 1 FROM reservation_payments rp WHERE rp.reservation_id = r.id AND rp.status = 'paid') THEN FALSE
          ELSE r.payment_required
        END AS payment_required,
        r.platform_fee_amount,
        r.owner_amount,
        r.stripe_checkout_session_id,
        r.stripe_payment_intent_id,
        COALESCE(r.paid_at, (SELECT MAX(rp.paid_at) FROM reservation_payments rp WHERE rp.reservation_id = r.id AND rp.status = 'paid')) AS paid_at,
        CASE
          WHEN r.status = 'approved_waiting_payment'
           AND EXISTS (SELECT 1 FROM reservation_payments rp WHERE rp.reservation_id = r.id AND rp.status = 'paid') THEN 'approved'
          ELSE r.status
        END AS status,
        r.created_at,
        r.updated_at,
        w.name AS lake_name,
        u.full_name,
        u.email,
        COALESCE((
          SELECT json_agg(rfd.fishing_date::text ORDER BY rfd.fishing_date)
          FROM reservation_fishing_days rfd
          WHERE rfd.reservation_id = r.id
        ), '[]'::json) AS fishing_dates,
        COALESCE((
          SELECT json_agg(rnf.night_date::text ORDER BY rnf.night_date)
          FROM reservation_night_fishing rnf
          WHERE rnf.reservation_id = r.id
        ), '[]'::json) AS night_fishing_dates,
        COALESCE((
          SELECT json_agg(rm.name ORDER BY rm.name)
          FROM lake_reservation_rooms rrm
          JOIN lake_rooms rm ON rm.id = rrm.room_id
          WHERE rrm.reservation_id = r.id
        ), '[]'::json) AS room_names,
        COALESCE((
          SELECT json_agg(ls.spot_number ORDER BY ls.spot_number)
          FROM reservation_spots rs
          JOIN lake_spots ls ON ls.id = rs.spot_id
          WHERE rs.reservation_id = r.id
        ), '[]'::json) AS spot_numbers
      FROM lake_reservations r
      JOIN water_bodies w ON w.id = r.water_body_id
      JOIN users u ON u.id = r.user_id
      WHERE r.water_body_id = $1
        AND w.owner_id = $2
      ORDER BY
        CASE r.status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 WHEN 'rejected' THEN 3 WHEN 'cancelled' THEN 4 ELSE 5 END,
        r.created_at DESC
    `, [req.params.waterBodyId, req.user]);

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load owner reservations' });
  }
};


const getOwnerLakeEarnings = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const summaryQ = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount), 0)::numeric AS total_revenue,
        COALESCE(SUM(platform_fee_amount), 0)::numeric AS platform_fee,
        COALESCE(SUM(owner_amount), 0)::numeric AS owner_earnings,
        COUNT(*)::int AS paid_reservations,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN owner_amount ELSE 0 END), 0)::numeric AS pending_payouts
      FROM lake_reservations
      WHERE water_body_id = $1
        AND payment_status = 'paid'
        AND status NOT IN ('cancelled', 'canceled', 'rejected')
        AND COALESCE(paid_at, updated_at, created_at) >= $2
    `, [req.params.waterBodyId, monthStart]);

    const transactionsQ = await pool.query(`
      SELECT
        r.id,
        r.total_amount,
        r.platform_fee_amount,
        r.owner_amount,
        r.payment_status,
        r.status,
        r.paid_at,
        r.created_at,
        w.name AS lake_name,
        u.full_name AS customer_name,
        u.email AS customer_email
      FROM lake_reservations r
      JOIN water_bodies w ON w.id = r.water_body_id
      JOIN users u ON u.id = r.user_id
      WHERE r.water_body_id = $1
        AND w.owner_id = $2
        AND r.payment_status = 'paid'
        AND r.status NOT IN ('cancelled', 'canceled', 'rejected')
      ORDER BY COALESCE(r.paid_at, r.created_at) DESC
      LIMIT 50
    `, [req.params.waterBodyId, req.user]);

    const reportsQ = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', COALESCE(paid_at, updated_at, created_at)), 'YYYY-MM') AS month_key,
        TO_CHAR(DATE_TRUNC('month', COALESCE(paid_at, updated_at, created_at)), 'FMMonth YYYY') AS month_label,
        COALESCE(SUM(total_amount), 0)::numeric AS total_revenue,
        COALESCE(SUM(platform_fee_amount), 0)::numeric AS platform_fee,
        COALESCE(SUM(owner_amount), 0)::numeric AS owner_earnings,
        COUNT(*)::int AS paid_reservations
      FROM lake_reservations
      WHERE water_body_id = $1
        AND payment_status = 'paid'
        AND status NOT IN ('cancelled', 'canceled', 'rejected')
      GROUP BY DATE_TRUNC('month', COALESCE(paid_at, updated_at, created_at))
      ORDER BY DATE_TRUNC('month', COALESCE(paid_at, updated_at, created_at)) DESC
      LIMIT 12
    `, [req.params.waterBodyId]);

    res.json({
      current_month: summaryQ.rows[0] || {
        total_revenue: 0,
        platform_fee: 0,
        owner_earnings: 0,
        paid_reservations: 0,
        pending_payouts: 0,
      },
      transactions: transactionsQ.rows,
      monthly_reports: reportsQ.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load owner earnings' });
  }
};

const getOwnerLakeSpotAvailability = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });

    const date = formatDateParam(req.query.date);
    if (!date) return res.status(400).json({ error: 'date is required' });

    const spotsQ = await pool.query(`
      SELECT id, spot_number, is_active
      FROM lake_spots
      WHERE water_body_id = $1
      ORDER BY spot_number ASC
    `, [req.params.waterBodyId]);

    const reservationsQ = await pool.query(`
      SELECT
        r.id,
        r.status,
        r.user_id,
        COALESCE(r.requested_spots, r.people_count, 1) AS requested_spots,
        u.full_name,
        u.email,
        COALESCE((
          SELECT json_agg(ls.spot_number ORDER BY ls.spot_number)
          FROM reservation_spots rs
          JOIN lake_spots ls ON ls.id = rs.spot_id
          WHERE rs.reservation_id = r.id
        ), '[]'::json) AS spot_numbers,
        COALESCE((
          SELECT json_agg(rs.spot_id::text ORDER BY ls.spot_number)
          FROM reservation_spots rs
          JOIN lake_spots ls ON ls.id = rs.spot_id
          WHERE rs.reservation_id = r.id
        ), '[]'::json) AS spot_ids
      FROM lake_reservations r
      JOIN users u ON u.id = r.user_id
      WHERE r.water_body_id = $1
        AND r.status IN ('pending', 'approved')
        AND daterange(r.start_date::date, (r.end_date::date + 1)::date, '[)') @> $2::date
      ORDER BY CASE r.status WHEN 'approved' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, r.created_at ASC
    `, [req.params.waterBodyId, date]);

    const blockedQ = await pool.query(`
      SELECT id, reason
      FROM lake_blocked_dates
      WHERE water_body_id = $1 AND blocked_date = $2::date
      LIMIT 1
    `, [req.params.waterBodyId, date]);

    const reservationBySpotId = new Map();
    for (const reservation of reservationsQ.rows) {
      for (const spotId of reservation.spot_ids || []) {
        reservationBySpotId.set(String(spotId), reservation);
      }
    }

    const spots = spotsQ.rows.map((spot) => {
      const reservation = reservationBySpotId.get(String(spot.id));
      if (!spot.is_active) {
        return { ...spot, status: 'inactive', is_available: false };
      }
      if (blockedQ.rows.length) {
        return { ...spot, status: 'blocked', is_available: false, reason: blockedQ.rows[0].reason || null };
      }
      if (reservation) {
        return {
          ...spot,
          status: reservation.status,
          is_available: false,
          reservation_id: reservation.id,
          user_name: reservation.full_name,
          user_email: reservation.email,
        };
      }
      return { ...spot, status: 'free', is_available: true };
    });

    const capacityReservations = reservationsQ.rows.filter((reservation) => !Array.isArray(reservation.spot_ids) || reservation.spot_ids.length === 0);

    res.json({
      date,
      blocked: blockedQ.rows[0] || null,
      spots,
      capacity_reservations: capacityReservations,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load spot availability' });
  }
};

const getOwnerBlockedDates = async (req, res) => {
  try {
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    const q = await pool.query(`SELECT id, water_body_id, blocked_date, reason, created_at FROM lake_blocked_dates WHERE water_body_id = $1 ORDER BY blocked_date ASC`, [req.params.waterBodyId]);
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load blocked dates' });
  }
};

const createOwnerBlockedDate = async (req, res) => {
  try {
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    const startDate = String(req.body.start_date || req.body.blocked_date || '').trim();
    const endDate = String(req.body.end_date || req.body.start_date || req.body.blocked_date || '').trim();
    const reason = String(req.body.reason || '').trim() || null;
    if (!startDate || !endDate) return res.status(400).json({ error: 'start_date and end_date are required' });
    if (new Date(`${endDate}T00:00:00Z`) < new Date(`${startDate}T00:00:00Z`)) {
      return res.status(400).json({ error: 'end_date must be after or equal to start_date' });
    }

    const createdRows = [];
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const final = new Date(`${endDate}T00:00:00Z`);
    while (cursor <= final) {
      const dateString = cursor.toISOString().slice(0, 10);
      const q = await pool.query(
        `INSERT INTO lake_blocked_dates (water_body_id, blocked_date, reason)
         VALUES ($1, $2, $3)
         ON CONFLICT (water_body_id, blocked_date)
         DO UPDATE SET reason = EXCLUDED.reason
         RETURNING *`,
        [req.params.waterBodyId, dateString, reason]
      );
      createdRows.push(q.rows[0]);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    res.json(createdRows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to add blocked date range' });
  }
};

const deleteOwnerBlockedDate = async (req, res) => {
  try {
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    await pool.query(`DELETE FROM lake_blocked_dates WHERE id = $1 AND water_body_id = $2`, [req.params.blockedDateId, req.params.waterBodyId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete blocked date' });
  }
};

const getLakeSpots = async (req, res) => {
  try {
    await ensureSchema();
    const { lakeId } = req.params;
    const lake = await ensureOwnedLake(lakeId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });

    const q = await pool.query(`
      SELECT id, water_body_id, spot_number, is_active, created_at, updated_at
      FROM lake_spots
      WHERE water_body_id = $1
      ORDER BY spot_number ASC
    `, [lakeId]);

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load lake spots' });
  }
};

const syncLakeSpots = async (req, res) => {
  try {
    await ensureSchema();
    const { lakeId } = req.params;
    const lake = await ensureOwnedLake(lakeId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });

    const spotsCount = Number(req.body.spots_count);
    if (!Number.isInteger(spotsCount) || spotsCount < 0) {
      return res.status(400).json({ error: 'spots_count must be 0 or greater' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE water_bodies SET spots_count = $3, updated_at = NOW() WHERE id = $1 AND owner_id = $2`,
        [lakeId, req.user, spotsCount]
      );

      const existingQ = await client.query(
        `SELECT spot_number FROM lake_spots WHERE water_body_id = $1 ORDER BY spot_number ASC`,
        [lakeId]
      );
      const existing = new Set(existingQ.rows.map((row) => Number(row.spot_number)));

      for (let spotNumber = 1; spotNumber <= spotsCount; spotNumber += 1) {
        if (!existing.has(spotNumber)) {
          await client.query(
            `INSERT INTO lake_spots (water_body_id, spot_number, is_active, updated_at) VALUES ($1, $2, TRUE, NOW())`,
            [lakeId, spotNumber]
          );
        }
      }

      const syncedQ = await client.query(`
        SELECT id, water_body_id, spot_number, is_active, created_at, updated_at
        FROM lake_spots
        WHERE water_body_id = $1
        ORDER BY spot_number ASC
      `, [lakeId]);

      await client.query('COMMIT');
      res.json(syncedQ.rows);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to sync lake spots' });
  }
};

const updateLakeSpot = async (req, res) => {
  try {
    await ensureSchema();
    const { lakeId, spotId } = req.params;
    const lake = await ensureOwnedLake(lakeId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });

    const existing = await pool.query(
      `SELECT * FROM lake_spots WHERE id = $1 AND water_body_id = $2`,
      [spotId, lakeId]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Spot not found' });

    const current = existing.rows[0];
    const isActive = typeof req.body.is_active === 'boolean' ? req.body.is_active : Boolean(current.is_active);

    const q = await pool.query(`
      UPDATE lake_spots
      SET is_active = $3, updated_at = NOW()
      WHERE id = $1 AND water_body_id = $2
      RETURNING id, water_body_id, spot_number, is_active, created_at, updated_at
    `, [spotId, lakeId, isActive]);

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update lake spot' });
  }
};

const getLakeRooms = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    const q = await pool.query(`SELECT * FROM lake_rooms WHERE water_body_id = $1 ORDER BY sort_order ASC, name ASC`, [req.params.waterBodyId]);
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load rooms' });
  }
};

const createLakeRoom = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    const name = String(req.body.name || '').trim();
    const capacity = Number(req.body.capacity || 1);
    const pricePerNight = Number(req.body.price_per_night || 0);
    const isActive = typeof req.body.is_active === 'boolean' ? req.body.is_active : true;
    const sortOrder = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
    if (!name) return res.status(400).json({ error: 'Room name is required' });
    if (!Number.isInteger(capacity) || capacity < 1) return res.status(400).json({ error: 'capacity must be at least 1' });
    if (!Number.isFinite(pricePerNight) || pricePerNight < 0) return res.status(400).json({ error: 'price_per_night must be 0 or greater' });
    const q = await pool.query(`INSERT INTO lake_rooms (water_body_id, name, capacity, price_per_night, is_active, sort_order, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`, [req.params.waterBodyId, name, capacity, pricePerNight, isActive, sortOrder]);
    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create room' });
  }
};

const updateLakeRoom = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    const existing = await pool.query(`SELECT * FROM lake_rooms WHERE id = $1 AND water_body_id = $2`, [req.params.roomId, req.params.waterBodyId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Room not found' });
    const current = existing.rows[0];
    const name = String(req.body.name ?? current.name ?? '').trim();
    const capacity = req.body.capacity !== undefined ? Number(req.body.capacity) : Number(current.capacity || 1);
    const pricePerNight = req.body.price_per_night !== undefined ? Number(req.body.price_per_night) : Number(current.price_per_night || 0);
    const isActive = typeof req.body.is_active === 'boolean' ? req.body.is_active : Boolean(current.is_active);
    const sortOrder = req.body.sort_order !== undefined ? Number(req.body.sort_order) : Number(current.sort_order || 0);
    if (!name) return res.status(400).json({ error: 'Room name is required' });
    if (!Number.isInteger(capacity) || capacity < 1) return res.status(400).json({ error: 'capacity must be at least 1' });
    if (!Number.isFinite(pricePerNight) || pricePerNight < 0) return res.status(400).json({ error: 'price_per_night must be 0 or greater' });
    const q = await pool.query(`UPDATE lake_rooms SET name = $3, capacity = $4, price_per_night = $5, is_active = $6, sort_order = $7, updated_at = NOW() WHERE id = $1 AND water_body_id = $2 RETURNING *`, [req.params.roomId, req.params.waterBodyId, name, capacity, pricePerNight, isActive, sortOrder]);
    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update room' });
  }
};

const deleteLakeRoom = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    await pool.query(`DELETE FROM lake_rooms WHERE id = $1 AND water_body_id = $2`, [req.params.roomId, req.params.waterBodyId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete room' });
  }
};

const getLakePhotos = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    const q = await pool.query(`SELECT * FROM lake_gallery_photos WHERE water_body_id = $1 ORDER BY sort_order ASC, created_at DESC`, [req.params.waterBodyId]);
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load photos' });
  }
};

const uploadLakePhoto = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: 'at least one image file is required' });

    const captions = req.body.captions || req.body.caption || [];
    const sortBase = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
    const captionList = Array.isArray(captions) ? captions : [captions];
    const uploaded = [];
    const failed = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      try {
        const caption = String(captionList[index] || '').trim() || null;
        const q = await pool.query(
          `INSERT INTO lake_gallery_photos (water_body_id, image_url, caption, sort_order, uploaded_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [req.params.waterBodyId, file.filename, caption, sortBase + index, req.user]
        );
        uploaded.push(q.rows[0]);
      } catch (error) {
        failed.push({ original_name: file.originalname, error: error.message || 'Failed to save image' });
      }
    }

    res.json({ uploaded, failed });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to upload lake photo' });
  }
};

const deleteLakePhoto = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });
    await pool.query(`DELETE FROM lake_gallery_photos WHERE id = $1 AND water_body_id = $2`, [req.params.photoId, req.params.waterBodyId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete lake photo' });
  }
};


const getOwnerLakeCatches = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });

    const q = await pool.query(`
      SELECT
        c.id,
        c.water_body_id,
        c.user_id,
        c.species,
        c.weight_kg,
        c.catch_time,
        c.notes,
        c.image_url,
        c.created_at,
        u.full_name,
        u.email
      FROM catch_logs c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.water_body_id = $1
        AND c.image_url IS NOT NULL
        AND TRIM(c.image_url) <> ''
      ORDER BY COALESCE(c.catch_time, c.created_at) DESC
      LIMIT 100
    `, [req.params.waterBodyId]);

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load user catch photos' });
  }
};

const deleteOwnerCatchPhoto = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });

    const q = await pool.query(
      `UPDATE catch_logs
       SET image_url = NULL
       WHERE id = $1 AND water_body_id = $2 AND image_url IS NOT NULL
       RETURNING id`,
      [req.params.catchId, req.params.waterBodyId]
    );

    if (!q.rows.length) return res.status(404).json({ error: 'Catch photo not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to remove user catch photo' });
  }
};

const reportOwnerLakeCatch = async (req, res) => {
  try {
    await ensureSchema();
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Водоемът не е намерен или не е ваш' });

    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'reason is required' });

    const catchQ = await pool.query(
      `SELECT id, user_id FROM catch_logs WHERE id = $1 AND water_body_id = $2 LIMIT 1`,
      [req.params.catchId, req.params.waterBodyId]
    );
    if (!catchQ.rows.length) return res.status(404).json({ error: 'Catch not found' });

    const q = await pool.query(
      `INSERT INTO lake_user_reports (water_body_id, catch_id, reported_user_id, reported_by, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.waterBodyId, req.params.catchId, catchQ.rows[0].user_id, req.user, reason]
    );

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to report user' });
  }
};

module.exports = {
  getOwnerLakes,
  getMyClaimRequests,
  createClaimRequest,
  updateOwnerLake,
  getOwnerLakeReservations,
  getOwnerLakeEarnings,
  getOwnerLakeSpotAvailability,
  getOwnerBlockedDates,
  createOwnerBlockedDate,
  deleteOwnerBlockedDate,
  getLakeSpots,
  syncLakeSpots,
  updateLakeSpot,
  getLakeRooms,
  createLakeRoom,
  updateLakeRoom,
  deleteLakeRoom,
  getLakePhotos,
  uploadLakePhoto,
  deleteLakePhoto,
  getOwnerLakeCatches,
  deleteOwnerCatchPhoto,
  reportOwnerLakeCatch,
};
