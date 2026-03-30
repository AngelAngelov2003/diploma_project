const pool = require("../db");
const {
  refreshWaterBodyMaterializedViews,
} = require("../services/materializedViewService");

const getOwnerLakes = async (req, res) => {
  try {
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
      [req.user],
    );

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load owner lakes" });
  }
};

const getMyClaimRequests = async (req, res) => {
  try {
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
      [req.user],
    );

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load claim requests" });
  }
};

const createClaimRequest = async (req, res) => {
  try {
    const { water_body_id, full_name, email, phone, company_name, message } =
      req.body;

    const waterBodyId = String(water_body_id || "").trim();
    const nextFullName = String(full_name || "").trim();
    const nextEmail = String(email || "")
      .trim()
      .toLowerCase();
    const nextPhone = String(phone || "").trim() || null;
    const nextCompanyName = String(company_name || "").trim() || null;
    const nextMessage = String(message || "").trim() || null;
    const proofDocumentUrl = req.file ? req.file.filename : null;

    if (lake.owner_id) {
      return res.status(400).json({
        message: "This lake already has an owner",
      });
    }

    if (!waterBodyId) {
      return res.status(400).json({ error: "water_body_id is required" });
    }

    if (!nextFullName) {
      return res.status(400).json({ error: "full_name is required" });
    }

    if (!nextEmail) {
      return res.status(400).json({ error: "email is required" });
    }

    if (!proofDocumentUrl) {
      return res.status(400).json({ error: "proof_document is required" });
    }

    const lakeQ = await pool.query(
      `
        SELECT id, name, is_private, is_reservable, owner_id
        FROM water_bodies
        WHERE id = $1
      `,
      [waterBodyId],
    );

    if (!lakeQ.rows.length) {
      return res.status(404).json({ error: "Lake not found" });
    }

    const lake = lakeQ.rows[0];

    if (!lake.is_private || !lake.is_reservable) {
      return res.status(400).json({
        error: "Only private, reservable lakes can be requested",
      });
    }

    if (lake.owner_id) {
      return res.status(400).json({ error: "This lake already has an owner" });
    }

    const existingPendingQ = await pool.query(
      `
        SELECT id
        FROM lake_owner_claim_requests
        WHERE water_body_id = $1 AND user_id = $2 AND status = 'pending'
        LIMIT 1
      `,
      [waterBodyId, req.user],
    );

    if (existingPendingQ.rows.length) {
      return res
        .status(400)
        .json({ error: "You already have a pending request for this lake" });
    }

    const q = await pool.query(
      `
        INSERT INTO lake_owner_claim_requests (
          water_body_id,
          user_id,
          full_name,
          email,
          phone,
          company_name,
          message,
          proof_document_url,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())
        RETURNING *
      `,
      [
        waterBodyId,
        req.user,
        nextFullName,
        nextEmail,
        nextPhone,
        nextCompanyName,
        nextMessage,
        proofDocumentUrl,
      ],
    );

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit claim request" });
  }
};

const updateOwnerLake = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const {
      name,
      description,
      type,
      is_private,
      price_per_day,
      capacity,
      is_reservable,
      availability_notes,
    } = req.body;

    const existing = await pool.query(
      `
        SELECT *
        FROM water_bodies
        WHERE id = $1 AND owner_id = $2
      `,
      [waterBodyId, req.user],
    );

    if (!existing.rows.length) {
      return res
        .status(404)
        .json({ error: "Lake not found or not owned by you" });
    }

    const current = existing.rows[0];

    const nextName = String(name ?? current.name ?? "").trim();
    const nextDescription =
      String(description ?? current.description ?? "").trim() || null;
    const nextType = String(type ?? current.type ?? "").trim() || null;
    let nextIsPrivate =
      typeof is_private === "boolean"
        ? is_private
        : Boolean(current.is_private);
    const nextPricePerDay =
      price_per_day !== undefined
        ? Number(price_per_day)
        : Number(current.price_per_day || 0);
    const nextCapacity =
      capacity !== undefined ? Number(capacity) : Number(current.capacity || 1);
    let nextIsReservable =
      typeof is_reservable === "boolean"
        ? is_reservable
        : Boolean(current.is_reservable);
    const nextAvailabilityNotes =
      String(availability_notes ?? current.availability_notes ?? "").trim() ||
      null;

    if (nextIsReservable) {
      nextIsPrivate = true;
    }

    if (!nextIsPrivate) {
      nextIsReservable = false;
    }

    if (!nextName) {
      return res.status(400).json({ error: "Lake name is required" });
    }

    if (!Number.isFinite(nextPricePerDay) || nextPricePerDay < 0) {
      return res
        .status(400)
        .json({ error: "price_per_day must be 0 or greater" });
    }

    if (!Number.isInteger(nextCapacity) || nextCapacity < 1) {
      return res
        .status(400)
        .json({ error: "capacity must be an integer greater than 0" });
    }

    const q = await pool.query(
      `
        UPDATE water_bodies
        SET
          name = $3,
          description = $4,
          type = $5,
          is_private = $6,
          price_per_day = $7,
          capacity = $8,
          is_reservable = $9,
          availability_notes = $10,
          updated_at = NOW()
        WHERE id = $1 AND owner_id = $2
        RETURNING id, name, description, type, is_private, owner_id, price_per_day, capacity, is_reservable, availability_notes, created_at, updated_at
      `,
      [
        waterBodyId,
        req.user,
        nextName,
        nextDescription,
        nextType,
        nextIsPrivate,
        nextPricePerDay,
        nextCapacity,
        nextIsReservable,
        nextAvailabilityNotes,
      ],
    );

    await refreshWaterBodyMaterializedViews();

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update owner lake" });
  }
};

const getOwnerBlockedDates = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    const ownerQ = await pool.query(
      `
        SELECT 1
        FROM water_bodies
        WHERE id = $1 AND owner_id = $2
      `,
      [waterBodyId, req.user],
    );

    if (!ownerQ.rows.length) {
      return res
        .status(404)
        .json({ error: "Lake not found or not owned by you" });
    }

    const q = await pool.query(
      `
        SELECT id, water_body_id, blocked_date, reason, created_at
        FROM lake_blocked_dates
        WHERE water_body_id = $1
        ORDER BY blocked_date ASC
      `,
      [waterBodyId],
    );

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load blocked dates" });
  }
};

const createOwnerBlockedDate = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const { blocked_date, reason } = req.body;

    if (!blocked_date) {
      return res.status(400).json({ error: "blocked_date is required" });
    }

    const ownerQ = await pool.query(
      `
        SELECT 1
        FROM water_bodies
        WHERE id = $1 AND owner_id = $2
      `,
      [waterBodyId, req.user],
    );

    if (!ownerQ.rows.length) {
      return res
        .status(404)
        .json({ error: "Lake not found or not owned by you" });
    }

    const q = await pool.query(
      `
        INSERT INTO lake_blocked_dates (water_body_id, blocked_date, reason)
        VALUES ($1, $2, $3)
        ON CONFLICT (water_body_id, blocked_date) DO UPDATE
        SET reason = EXCLUDED.reason
        RETURNING *
      `,
      [waterBodyId, blocked_date, String(reason || "").trim() || null],
    );

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to add blocked date" });
  }
};

const deleteOwnerBlockedDate = async (req, res) => {
  try {
    const { waterBodyId, blockedDateId } = req.params;

    const ownerQ = await pool.query(
      `
        SELECT 1
        FROM water_bodies
        WHERE id = $1 AND owner_id = $2
      `,
      [waterBodyId, req.user],
    );

    if (!ownerQ.rows.length) {
      return res
        .status(404)
        .json({ error: "Lake not found or not owned by you" });
    }

    await pool.query(
      `
        DELETE FROM lake_blocked_dates
        WHERE id = $1 AND water_body_id = $2
      `,
      [blockedDateId, waterBodyId],
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete blocked date" });
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
};
