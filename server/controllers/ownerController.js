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
        w.availability_notes,
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
    if (!lakeQ.rows.length) return res.status(404).json({ error: 'Lake not found' });
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
    if (!current) return res.status(404).json({ error: 'Lake not found or not owned by you' });
    const nextName = String(req.body.name ?? current.name ?? '').trim();
    const nextDescription = String(req.body.description ?? current.description ?? '').trim() || null;
    const nextType = String(req.body.type ?? current.type ?? '').trim() || null;
    let nextIsPrivate = typeof req.body.is_private === 'boolean' ? req.body.is_private : Boolean(current.is_private);
    let nextIsReservable = typeof req.body.is_reservable === 'boolean' ? req.body.is_reservable : Boolean(current.is_reservable);
    const nextPricePerDay = req.body.price_per_day !== undefined ? Number(req.body.price_per_day) : Number(current.price_per_day || 0);
    const nextCapacity = req.body.capacity !== undefined ? Number(req.body.capacity) : Number(current.capacity || 1);
    const nextSpotsCount = req.body.spots_count !== undefined ? Number(req.body.spots_count) : Number(current.spots_count || 0);
    const nextAvailabilityNotes = String(req.body.availability_notes ?? current.availability_notes ?? '').trim() || null;
    const nextAllowsNightFishing = typeof req.body.allows_night_fishing === 'boolean' ? req.body.allows_night_fishing : Boolean(current.allows_night_fishing);
    const nextNightFishingPrice = req.body.night_fishing_price !== undefined ? Number(req.body.night_fishing_price) : Number(current.night_fishing_price || 0);
    const nextHasHousing = typeof req.body.has_housing === 'boolean' ? req.body.has_housing : Boolean(current.has_housing);
    if (nextIsReservable) nextIsPrivate = true;
    if (!nextIsPrivate) nextIsReservable = false;
    if (!nextName) return res.status(400).json({ error: 'Lake name is required' });
    if (!Number.isFinite(nextPricePerDay) || nextPricePerDay < 0) return res.status(400).json({ error: 'price_per_day must be 0 or greater' });
    if (!Number.isInteger(nextCapacity) || nextCapacity < 1) return res.status(400).json({ error: 'capacity must be an integer greater than 0' });
    if (!Number.isInteger(nextSpotsCount) || nextSpotsCount < 0) return res.status(400).json({ error: 'spots_count must be 0 or greater' });
    if (!Number.isFinite(nextNightFishingPrice) || nextNightFishingPrice < 0) return res.status(400).json({ error: 'night_fishing_price must be 0 or greater' });
    const q = await pool.query(`
      UPDATE water_bodies
      SET name = $3, description = $4, type = $5, is_private = $6, price_per_day = $7, capacity = $8, spots_count = $9, is_reservable = $10, availability_notes = $11, allows_night_fishing = $12, night_fishing_price = $13, has_housing = $14, updated_at = NOW()
      WHERE id = $1 AND owner_id = $2
      RETURNING id, name, description, type, is_private, owner_id, price_per_day, capacity, spots_count, is_reservable, availability_notes, allows_night_fishing, night_fishing_price, has_housing, created_at, updated_at
    `, [waterBodyId, req.user, nextName, nextDescription, nextType, nextIsPrivate, nextPricePerDay, nextCapacity, nextSpotsCount, nextIsReservable, nextAvailabilityNotes, nextAllowsNightFishing, nextNightFishingPrice, nextHasHousing]);
    await refreshWaterBodyMaterializedViews();
    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update owner lake' });
  }
};

const getOwnerBlockedDates = async (req, res) => {
  try {
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });
    const q = await pool.query(`SELECT id, water_body_id, blocked_date, reason, created_at FROM lake_blocked_dates WHERE water_body_id = $1 ORDER BY blocked_date ASC`, [req.params.waterBodyId]);
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load blocked dates' });
  }
};

const createOwnerBlockedDate = async (req, res) => {
  try {
    const lake = await ensureOwnedLake(req.params.waterBodyId, req.user);
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });
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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });
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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });

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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });

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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });

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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });
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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });
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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });
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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });
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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });
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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });
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
    if (!lake) return res.status(404).json({ error: 'Lake not found or not owned by you' });
    await pool.query(`DELETE FROM lake_gallery_photos WHERE id = $1 AND water_body_id = $2`, [req.params.photoId, req.params.waterBodyId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete lake photo' });
  }
};

module.exports = {
  getOwnerLakes,
  getMyClaimRequests,
  createClaimRequest,
  updateOwnerLake,
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
};
