const pool = require("../db");

const getAdminAnalytics = async (req, res) => {
  try {
    const [
      usersQ,
      activeUsersQ,
      waterBodiesQ,
      privateLakesQ,
      publicLakesQ,
      catchesQ,
      reviewsQ,
      reservationsQ,
      pendingReservationsQ,
      approvedReservationsQ,
      subscriptionsQ,
      pendingOwnerClaimsQ,
      topLakesQ,
      topSpeciesQ,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM users`),
      pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE is_active = TRUE`),
      pool.query(`SELECT COUNT(*)::int AS count FROM water_bodies`),
      pool.query(`SELECT COUNT(*)::int AS count FROM water_bodies WHERE is_private = TRUE`),
      pool.query(`SELECT COUNT(*)::int AS count FROM water_bodies WHERE is_private = FALSE`),
      pool.query(`SELECT COUNT(*)::int AS count FROM catch_logs`),
      pool.query(`SELECT COUNT(*)::int AS count FROM water_body_reviews`),
      pool.query(`SELECT COUNT(*)::int AS count FROM lake_reservations`),
      pool.query(`SELECT COUNT(*)::int AS count FROM lake_reservations WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM lake_reservations WHERE status = 'approved'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM lake_subscriptions`),
      pool.query(`SELECT COUNT(*)::int AS count FROM lake_owner_claim_requests WHERE status = 'pending'`),
      pool.query(`
        SELECT
          w.id AS water_body_id,
          w.name AS lake_name,
          COUNT(c.id)::int AS catches_count
        FROM water_bodies w
        LEFT JOIN catch_logs c ON c.water_body_id = w.id
        GROUP BY w.id, w.name
        ORDER BY catches_count DESC, w.name ASC
        LIMIT 5
      `),
      pool.query(`
        SELECT species, COUNT(*)::int AS catches_count
        FROM catch_logs
        WHERE species IS NOT NULL AND TRIM(species) <> ''
        GROUP BY species
        ORDER BY catches_count DESC, species ASC
        LIMIT 5
      `),
    ]);

    res.json({
      totals: {
        users: Number(usersQ.rows[0]?.count || 0),
        active_users: Number(activeUsersQ.rows[0]?.count || 0),
        water_bodies: Number(waterBodiesQ.rows[0]?.count || 0),
        private_lakes: Number(privateLakesQ.rows[0]?.count || 0),
        public_lakes: Number(publicLakesQ.rows[0]?.count || 0),
        catches: Number(catchesQ.rows[0]?.count || 0),
        reviews: Number(reviewsQ.rows[0]?.count || 0),
        reservations: Number(reservationsQ.rows[0]?.count || 0),
        pending_reservations: Number(pendingReservationsQ.rows[0]?.count || 0),
        approved_reservations: Number(approvedReservationsQ.rows[0]?.count || 0),
        subscriptions: Number(subscriptionsQ.rows[0]?.count || 0),
        pending_owner_claims: Number(pendingOwnerClaimsQ.rows[0]?.count || 0),
      },
      topLakes: topLakesQ.rows,
      topSpecies: topSpeciesQ.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load analytics" });
  }
};

const getUsers = async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT id, full_name, email, role, is_verified, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load users" });
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { full_name, email, role, is_active } = req.body;

    const existing = await pool.query(
      `
        SELECT *
        FROM users
        WHERE id = $1
      `,
      [userId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const current = existing.rows[0];

    const nextFullName = String(full_name ?? current.full_name ?? "").trim();
    const nextEmail = String(email ?? current.email ?? "").trim().toLowerCase();
    const nextRole = String(role ?? current.role ?? "user").trim().toLowerCase();
    const nextIsActive =
      typeof is_active === "boolean" ? is_active : Boolean(current.is_active);

    if (!nextFullName) {
      return res.status(400).json({ error: "full_name is required" });
    }

    if (!nextEmail) {
      return res.status(400).json({ error: "email is required" });
    }

    if (!["user", "owner", "admin"].includes(nextRole)) {
      return res.status(400).json({ error: "role must be user, owner, or admin" });
    }

    const emailConflict = await pool.query(
      `
        SELECT 1
        FROM users
        WHERE email = $1 AND id <> $2
        LIMIT 1
      `,
      [nextEmail, userId]
    );

    if (emailConflict.rows.length) {
      return res.status(400).json({ error: "Email already in use by another user" });
    }

    const q = await pool.query(
      `
        UPDATE users
        SET
          full_name = $2,
          email = $3,
          role = $4,
          is_active = $5,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, full_name, email, role, is_verified, is_active, created_at, updated_at
      `,
      [userId, nextFullName, nextEmail, nextRole, nextIsActive]
    );

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (String(userId) === String(req.user)) {
      return res.status(400).json({ error: "Admin cannot delete own account" });
    }

    const existing = await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]);

    if (!existing.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
};

const getWaterBodies = async (req, res) => {
  try {
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
        w.updated_at,
        u.full_name AS owner_name,
        u.email AS owner_email
      FROM water_bodies w
      LEFT JOIN users u ON u.id = w.owner_id
      ORDER BY w.created_at DESC, w.name ASC
    `);

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load water bodies" });
  }
};

const updateWaterBody = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const {
      name,
      description,
      type,
      is_private,
      owner_id,
      price_per_day,
      capacity,
      is_reservable,
      availability_notes,
    } = req.body;

    const existing = await pool.query(
      `
        SELECT *
        FROM water_bodies
        WHERE id = $1
      `,
      [waterBodyId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Water body not found" });
    }

    const current = existing.rows[0];

    const nextName = String(name ?? current.name ?? "").trim();
    const nextDescription = String(description ?? current.description ?? "").trim() || null;
    const nextType = String(type ?? current.type ?? "").trim() || null;
    const nextIsPrivate =
      typeof is_private === "boolean" ? is_private : Boolean(current.is_private);
    const nextOwnerId =
      owner_id === "" || owner_id === undefined ? current.owner_id : owner_id || null;
    const nextPricePerDay =
      price_per_day !== undefined ? Number(price_per_day) : Number(current.price_per_day || 0);
    const nextCapacity =
      capacity !== undefined ? Number(capacity) : Number(current.capacity || 1);
    const nextIsReservable =
      typeof is_reservable === "boolean" ? is_reservable : Boolean(current.is_reservable);
    const nextAvailabilityNotes =
      String(availability_notes ?? current.availability_notes ?? "").trim() || null;

    if (!nextName) {
      return res.status(400).json({ error: "name is required" });
    }

    if (!Number.isFinite(nextPricePerDay) || nextPricePerDay < 0) {
      return res.status(400).json({ error: "price_per_day must be 0 or greater" });
    }

    if (!Number.isInteger(nextCapacity) || nextCapacity < 1) {
      return res.status(400).json({ error: "capacity must be an integer greater than 0" });
    }

    if (nextOwnerId) {
      const ownerQ = await pool.query(
        `
          SELECT id, role
          FROM users
          WHERE id = $1
        `,
        [nextOwnerId]
      );

      if (!ownerQ.rows.length) {
        return res.status(400).json({ error: "Selected owner does not exist" });
      }

      if (ownerQ.rows[0].role !== "admin") {
        await pool.query(
          `
            UPDATE users
            SET role = 'owner', updated_at = NOW()
            WHERE id = $1
          `,
          [nextOwnerId]
        );
      }
    }

    const q = await pool.query(
      `
        UPDATE water_bodies
        SET
          name = $2,
          description = $3,
          type = $4,
          is_private = $5,
          owner_id = $6,
          price_per_day = $7,
          capacity = $8,
          is_reservable = $9,
          availability_notes = $10,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, description, type, is_private, owner_id, price_per_day, capacity, is_reservable, availability_notes, created_at, updated_at
      `,
      [
        waterBodyId,
        nextName,
        nextDescription,
        nextType,
        nextIsPrivate,
        nextOwnerId,
        nextPricePerDay,
        nextCapacity,
        nextIsReservable,
        nextAvailabilityNotes,
      ]
    );

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update water body" });
  }
};

const deleteWaterBody = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    const existing = await pool.query(`SELECT id FROM water_bodies WHERE id = $1`, [waterBodyId]);

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Water body not found" });
    }

    await pool.query(`DELETE FROM water_bodies WHERE id = $1`, [waterBodyId]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete water body" });
  }
};

const getReviews = async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT
        r.id,
        r.water_body_id,
        r.user_id,
        r.rating,
        r.comment,
        r.created_at,
        u.full_name,
        u.email,
        w.name AS lake_name
      FROM water_body_reviews r
      JOIN users u ON u.id = r.user_id
      JOIN water_bodies w ON w.id = r.water_body_id
      ORDER BY r.created_at DESC
    `);

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load reviews" });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const existing = await pool.query(`SELECT id FROM water_body_reviews WHERE id = $1`, [reviewId]);

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Review not found" });
    }

    await pool.query(`DELETE FROM water_body_reviews WHERE id = $1`, [reviewId]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete review" });
  }
};

const getOwnerClaimRequests = async (req, res) => {
  try {
    const q = await pool.query(`
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
        w.name AS lake_name,
        reviewer.full_name AS reviewed_by_name
      FROM lake_owner_claim_requests r
      JOIN water_bodies w ON w.id = r.water_body_id
      LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
      ORDER BY
        CASE r.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
          ELSE 4
        END,
        r.created_at DESC
    `);

    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load owner claim requests" });
  }
};

const updateOwnerClaimRequest = async (req, res) => {
  const client = await pool.connect();

  try {
    const { requestId } = req.params;
    const { status, admin_note } = req.body;

    const nextStatus = String(status || "").trim().toLowerCase();
    const nextAdminNote = String(admin_note || "").trim() || null;

    if (!["approved", "rejected", "pending"].includes(nextStatus)) {
      return res.status(400).json({ error: "status must be pending, approved or rejected" });
    }

    await client.query("BEGIN");

    const existingQ = await client.query(
      `
        SELECT r.*, w.owner_id, w.is_private
        FROM lake_owner_claim_requests r
        JOIN water_bodies w ON w.id = r.water_body_id
        WHERE r.id = $1::uuid
        FOR UPDATE
      `,
      [requestId]
    );

    if (!existingQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Claim request not found" });
    }

    const request = existingQ.rows[0];

    if (!request.is_private) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "The selected lake is not private" });
    }

    if (nextStatus === "approved") {
      const lakeQ = await client.query(
        `
          SELECT id, owner_id
          FROM water_bodies
          WHERE id = $1::uuid
          FOR UPDATE
        `,
        [request.water_body_id]
      );

      if (!lakeQ.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Lake not found" });
      }

      const currentOwnerId = lakeQ.rows[0].owner_id;

      if (currentOwnerId && String(currentOwnerId) !== String(request.user_id)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "This lake already has another owner" });
      }

      await client.query(
        `
          UPDATE water_bodies
          SET owner_id = $2::uuid, updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [request.water_body_id, request.user_id]
      );

      await client.query(
        `
          UPDATE users
          SET role = 'owner', updated_at = NOW()
          WHERE id = $1::uuid AND COALESCE(role, 'user') <> 'admin'
        `,
        [request.user_id]
      );
    }

    if (nextStatus === "pending") {
      await client.query(
        `
          UPDATE water_bodies
          SET owner_id = NULL, updated_at = NOW()
          WHERE id = $1::uuid AND owner_id = $2::uuid
        `,
        [request.water_body_id, request.user_id]
      );
    }

    const updateQ = await client.query(
      `
        UPDATE lake_owner_claim_requests
        SET
          status = $2::varchar,
          admin_note = $3::text,
          reviewed_by = CASE WHEN $2::text = 'pending' THEN NULL::uuid ELSE $4::uuid END,
          reviewed_at = CASE WHEN $2::text = 'pending' THEN NULL::timestamp ELSE NOW() END,
          updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING *
      `,
      [requestId, nextStatus, nextAdminNote, req.user]
    );

    if (nextStatus === "approved") {
      await client.query(
        `
          UPDATE lake_owner_claim_requests
          SET
            status = 'rejected',
            admin_note = COALESCE(admin_note, 'Another ownership request was approved for this lake'),
            reviewed_by = $2::uuid,
            reviewed_at = NOW(),
            updated_at = NOW()
          WHERE water_body_id = $1::uuid
            AND status = 'pending'
            AND id <> $3::uuid
        `,
        [request.water_body_id, req.user, requestId]
      );
    }

    await client.query("COMMIT");
    res.json(updateQ.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /admin/owner-claim-requests/:requestId failed:", err);
    res.status(500).json({ error: err.message || "Failed to review claim request" });
  } finally {
    client.release();
  }
};

const deleteOwnerClaimRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const existingQ = await pool.query(
      `
        SELECT id
        FROM lake_owner_claim_requests
        WHERE id = $1::uuid
      `,
      [requestId]
    );

    if (!existingQ.rows.length) {
      return res.status(404).json({ error: "Claim request not found" });
    }

    await pool.query(
      `
        DELETE FROM lake_owner_claim_requests
        WHERE id = $1::uuid
      `,
      [requestId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/owner-claim-requests/:requestId failed:", err);
    res.status(500).json({ error: err.message || "Failed to delete claim request" });
  }
};

module.exports = {
  getAdminAnalytics,
  getUsers,
  updateUser,
  deleteUser,
  getWaterBodies,
  updateWaterBody,
  deleteWaterBody,
  getReviews,
  deleteReview,
  getOwnerClaimRequests,
  updateOwnerClaimRequest,
  deleteOwnerClaimRequest,
};