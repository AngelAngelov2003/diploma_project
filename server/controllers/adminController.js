const pool = require("../db");
const { refreshWaterBodyMaterializedViews } = require("../services/materializedViewService");
const billingService = require("../services/billingService");

const getOwnerLakeCount = async (db, userId) => {
  const q = await db.query(
    `SELECT COUNT(*)::int AS count FROM water_bodies WHERE owner_id = $1::uuid`,
    [userId]
  );
  return Number(q.rows[0]?.count || 0);
};

const cleanupOwnerLakeData = async (db, userId, waterBodyId = null) => {
  const lakesQ = await db.query(
    `
      SELECT id
      FROM water_bodies
      WHERE owner_id = $1::uuid
        AND ($2::uuid IS NULL OR id = $2::uuid)
    `,
    [userId, waterBodyId]
  );

  const lakeIds = lakesQ.rows.map((row) => row.id);

  if (!lakeIds.length) {
    return { affectedLakeIds: [], remainingOwnedLakes: await getOwnerLakeCount(db, userId) };
  }

  await db.query(`DELETE FROM lake_rooms WHERE water_body_id = ANY($1::uuid[])`, [lakeIds]);
  await db.query(`DELETE FROM lake_spots WHERE water_body_id = ANY($1::uuid[])`, [lakeIds]);
  await db.query(`DELETE FROM lake_sectors WHERE water_body_id = ANY($1::uuid[])`, [lakeIds]);

  await db.query(
    `
      UPDATE water_bodies
      SET
        owner_id = NULL,
        is_reservable = FALSE,
        has_housing = FALSE,
        spots_count = 0,
        allows_night_fishing = FALSE,
        night_fishing_price = 0,
        updated_at = NOW()
      WHERE id = ANY($1::uuid[])
    `,
    [lakeIds]
  );

  const remainingOwnedLakes = await getOwnerLakeCount(db, userId);

  if (remainingOwnedLakes === 0) {
    await db.query(
      `
        UPDATE users
        SET role = 'user', updated_at = NOW()
        WHERE id = $1::uuid AND COALESCE(role, 'user') = 'owner'
      `,
      [userId]
    );

    await db.query(
      `
        UPDATE owner_billing_profiles
        SET owner_plan = 'free', subscription_status = 'inactive', updated_at = NOW()
        WHERE owner_id = $1::uuid
      `,
      [userId]
    );
  }

  return { affectedLakeIds: lakeIds, remainingOwnedLakes };
};

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
      revenueSummary,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM users`),
      pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE is_active = TRUE`),
      pool.query(`SELECT COUNT(*)::int AS count FROM water_bodies`),
      pool.query(`SELECT COUNT(*)::int AS count FROM water_bodies WHERE is_private = TRUE`),
      pool.query(`SELECT COUNT(*)::int AS count FROM water_bodies WHERE is_private = FALSE`),
      pool.query(`SELECT COUNT(*)::int AS count FROM catch_logs`),
      pool.query(`SELECT COUNT(*)::int AS count FROM water_body_reviews`),
      pool.query(`SELECT COUNT(*)::int AS count FROM lake_reservations`),
      pool.query(`SELECT COUNT(*)::int AS count FROM lake_reservations WHERE status = 'pending' AND COALESCE(end_date, start_date, reservation_date)::date >= CURRENT_DATE`),
      pool.query(`SELECT COUNT(*)::int AS count FROM lake_reservations WHERE status = 'approved' AND COALESCE(end_date, start_date, reservation_date)::date >= CURRENT_DATE`),
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
      billingService.getAdminRevenueSummary().catch((error) => {
        console.warn("[admin] Revenue summary skipped:", error.message);
        return {
          platform_commissions: 0,
          total_reservation_volume: 0,
          owner_earnings: 0,
          pending_checkout_volume: 0,
          paid_payments_count: 0,
          pending_payments_count: 0,
          connected_owner_statuses: [],
        };
      }),
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
      revenue: revenueSummary,
    });
  } catch (err) {
    res.status(500).json({ error: "Неуспешно зареждане на анализите" });
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
    res.status(500).json({ error: "Неуспешно зареждане на потребителите" });
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
      return res.status(404).json({ error: "Потребителят не е намерен" });
    }

    const current = existing.rows[0];

    const nextFullName = String(full_name ?? current.full_name ?? "").trim();
    const nextEmail = String(email ?? current.email ?? "").trim().toLowerCase();
    const nextRole = String(role ?? current.role ?? "user").trim().toLowerCase();
    const nextIsActive =
      typeof is_active === "boolean" ? is_active : Boolean(current.is_active);
    if (!nextFullName) {
      return res.status(400).json({ error: "Име и фамилия са задължителни" });
    }

    if (!nextEmail) {
      return res.status(400).json({ error: "Имейлът е задължителен" });
    }

    if (!["user", "owner", "admin"].includes(nextRole)) {
      return res.status(400).json({ error: "Ролята трябва да бъде user, owner или admin" });
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
      return res.status(400).json({ error: "Имейлът вече се използва от друг потребител" });
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

    if (String(current.role || '').toLowerCase() === 'owner' && nextRole === 'user') {
      await cleanupOwnerLakeData(pool, userId);
      await refreshWaterBodyMaterializedViews();
    }

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Неуспешно обновяване на потребителя" });
  }
};

const deleteUser = async (req, res) => {
  const client = await pool.connect();

  try {
    const { userId } = req.params;

    if (String(userId) === String(req.user)) {
      return res.status(400).json({ error: "Администраторът не може да изтрие собствения си акаунт" });
    }

    const existing = await client.query(`SELECT id, role FROM users WHERE id = $1`, [userId]);

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Потребителят не е намерен" });
    }

    await client.query("BEGIN");
    try {
      await cleanupOwnerLakeData(client, userId);
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await client.query("COMMIT");
    } catch (deleteErr) {
      await client.query("ROLLBACK");
      throw deleteErr;
    }

    await refreshWaterBodyMaterializedViews();
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/users/:userId failed:", err);
    res.status(500).json({ error: "Неуспешно изтриване на потребителя" });
  } finally {
    client.release();
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
    res.status(500).json({ error: "Неуспешно зареждане на водоемите" });
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
      return res.status(404).json({ error: "Водоемът не е намерен" });
    }

    const current = existing.rows[0];

    const nextName = String(name ?? current.name ?? "").trim();
    const nextDescription = String(description ?? current.description ?? "").trim() || null;
    const rawType = String(type ?? current.type ?? "reservoir").trim().toLowerCase();
    const typeAliases = {
      dam: "reservoir",
      reservoir: "reservoir",
      lake: "lake",
      pond: "lake",
      river: "lake",
      canal: "lake",
      язовир: "reservoir",
      езеро: "lake",
    };
    const nextType = typeAliases[rawType] || "lake";
    let nextIsPrivate =
      typeof is_private === "boolean" ? is_private : Boolean(current.is_private);
    const nextOwnerId =
      owner_id === "" || owner_id === undefined ? current.owner_id : owner_id || null;
    const nextPricePerDay =
      price_per_day !== undefined ? Number(price_per_day) : Number(current.price_per_day || 0);
    const nextCapacity =
      capacity !== undefined ? Number(capacity) : Number(current.capacity || 1);
    let nextIsReservable =
      typeof is_reservable === "boolean" ? is_reservable : Boolean(current.is_reservable);
    if (nextIsReservable) {
      nextIsPrivate = true;
    }

    if (!nextIsPrivate) {
      nextIsReservable = false;
    }

    if (!nextName) {
      return res.status(400).json({ error: "Името е задължително" });
    }

    if (!Number.isFinite(nextPricePerDay) || nextPricePerDay < 0) {
      return res.status(400).json({ error: "Цената на ден трябва да бъде 0 или повече" });
    }

    if (!Number.isInteger(nextCapacity) || nextCapacity < 1) {
      return res.status(400).json({ error: "Капацитетът трябва да бъде цяло число по-голямо от 0" });
    }

    if (nextOwnerId && !nextIsPrivate) {
      return res.status(400).json({
        error: "Публичен водоем не може да има зададен собственик. Първо го направете частен.",
      });
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
        return res.status(400).json({ error: "Избраният собственик не съществува" });
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
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, description, type, is_private, owner_id, price_per_day, capacity, is_reservable, created_at, updated_at
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
      ]
    );

    await refreshWaterBodyMaterializedViews();

    res.json(q.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Неуспешно обновяване на водоема" });
  }
};

const deleteWaterBody = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    const existing = await pool.query(`SELECT id FROM water_bodies WHERE id = $1`, [waterBodyId]);

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Водоемът не е намерен" });
    }

    await pool.query(`DELETE FROM water_bodies WHERE id = $1`, [waterBodyId]);
    await refreshWaterBodyMaterializedViews();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Неуспешно изтриване на водоема" });
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
        COALESCE(u.full_name, 'Изтрит потребител') AS full_name,
        u.email,
        COALESCE(w.name, 'Изтрит водоем') AS lake_name
      FROM water_body_reviews r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN water_bodies w ON w.id = r.water_body_id
      ORDER BY r.created_at DESC NULLS LAST
    `);

    res.json(q.rows);
  } catch (err) {
    console.error("getReviews admin error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на отзивите" });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const existing = await pool.query(`SELECT id FROM water_body_reviews WHERE id = $1`, [reviewId]);

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Ревюто не е намерено" });
    }

    await pool.query(`DELETE FROM water_body_reviews WHERE id = $1`, [reviewId]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Неуспешно изтриване на отзива" });
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
    res.status(500).json({ error: "Неуспешно зареждане на заявките за собственост" });
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
      return res.status(400).json({ error: "Статусът трябва да бъде pending, approved или rejected" });
    }

    await client.query("BEGIN");

    const existingQ = await client.query(
      `
        SELECT r.*, w.owner_id, w.is_private, w.is_reservable
        FROM lake_owner_claim_requests r
        JOIN water_bodies w ON w.id = r.water_body_id
        WHERE r.id = $1::uuid
        FOR UPDATE
      `,
      [requestId]
    );

    if (!existingQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Заявката за собственост не е намерена" });
    }

    const request = existingQ.rows[0];

    if (nextStatus === "approved" && !request.is_private) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Избраният водоем трябва да бъде частен",
      });
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
        return res.status(404).json({ error: "Водоемът не е намерен" });
      }

      const currentOwnerId = lakeQ.rows[0].owner_id;

      if (currentOwnerId && String(currentOwnerId) !== String(request.user_id)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Този водоем вече има друг собственик" });
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

    if (nextStatus === "pending" || nextStatus === "rejected") {
      await cleanupOwnerLakeData(client, request.user_id, request.water_body_id);
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
    await refreshWaterBodyMaterializedViews();
    res.json(updateQ.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /admin/owner-claim-requests/:requestId failed:", err);
    res.status(500).json({ error: err.message || "Неуспешно преглеждане на заявката" });
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
      return res.status(404).json({ error: "Заявката за собственост не е намерена" });
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
    res.status(500).json({ error: err.message || "Неуспешно изтриване на заявката" });
  }
};


const getUserReports = async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT
        r.*,
        w.name AS lake_name,
        c.species,
        c.weight_kg,
        c.notes AS catch_notes,
        c.image_url AS catch_image_url,
        c.catch_time,
        reported.full_name AS reported_user_name,
        reported.email AS reported_user_email,
        owner.full_name AS reported_by_name,
        owner.email AS reported_by_email,
        resolver.full_name AS resolved_by_name
      FROM lake_user_reports r
      LEFT JOIN water_bodies w ON w.id = r.water_body_id
      LEFT JOIN catch_logs c ON c.id = r.catch_id
      LEFT JOIN users reported ON reported.id = r.reported_user_id
      LEFT JOIN users owner ON owner.id = r.reported_by
      LEFT JOIN users resolver ON resolver.id = r.resolved_by
      ORDER BY
        CASE COALESCE(r.status, 'pending')
          WHEN 'pending' THEN 1
          WHEN 'reviewed' THEN 2
          WHEN 'resolved' THEN 3
          WHEN 'dismissed' THEN 4
          ELSE 5
        END,
        r.created_at DESC
    `);
    res.json(q.rows);
  } catch (err) {
    console.error("GET /admin/user-reports failed:", err);
    res.status(500).json({ error: "Неуспешно зареждане на докладите" });
  }
};

const updateUserReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const status = String(req.body.status || "").trim();
    const adminNote = typeof req.body.admin_note === "string" ? req.body.admin_note.trim() : null;
    const allowedStatuses = new Set(["pending", "reviewed", "resolved", "dismissed"]);

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "Невалиден статус на доклада" });
    }

    const q = await pool.query(
      `
        UPDATE lake_user_reports
        SET
          status = $2,
          admin_note = COALESCE($3, admin_note),
          resolved_by = CASE WHEN $2 IN ('resolved', 'dismissed') THEN $4::uuid ELSE resolved_by END,
          resolved_at = CASE WHEN $2 IN ('resolved', 'dismissed') THEN NOW() ELSE NULL END
        WHERE id = $1::uuid
        RETURNING *
      `,
      [reportId, status, adminNote, req.user]
    );

    if (!q.rows.length) {
      return res.status(404).json({ error: "Докладът не е намерен" });
    }

    res.json(q.rows[0]);
  } catch (err) {
    console.error("PATCH /admin/user-reports/:reportId failed:", err);
    res.status(500).json({ error: "Неуспешно обновяване на доклада" });
  }
};

const deleteUserReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const q = await pool.query(
      `DELETE FROM lake_user_reports WHERE id = $1::uuid RETURNING id`,
      [reportId]
    );

    if (!q.rows.length) {
      return res.status(404).json({ error: "Докладът не е намерен" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/user-reports/:reportId failed:", err);
    res.status(500).json({ error: "Неуспешно изтриване на доклада" });
  }
};

const getCatchLogs = async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT c.*, w.name AS lake_name, u.full_name, u.email
      FROM catch_logs c
      LEFT JOIN water_bodies w ON w.id = c.water_body_id
      LEFT JOIN users u ON u.id = c.user_id
      ORDER BY COALESCE(c.catch_time, c.created_at) DESC, c.created_at DESC
    `);
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Неуспешно зареждане на улова logs" });
  }
};

const deleteCatchLog = async (req, res) => {
  try {
    const { catchId } = req.params;
    await pool.query(`DELETE FROM catch_logs WHERE id = $1`, [catchId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Неуспешно изтриване на улова log" });
  }
};

const getGalleryPhotos = async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT p.*, w.name AS lake_name, u.full_name AS uploaded_by_name, u.email AS uploaded_by_email
      FROM lake_gallery_photos p
      LEFT JOIN water_bodies w ON w.id = p.water_body_id
      LEFT JOIN users u ON u.id = p.uploaded_by
      ORDER BY p.created_at DESC NULLS LAST, p.sort_order ASC
    `);
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: "Неуспешно зареждане на снимките от галерията" });
  }
};

const deleteGalleryPhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    await pool.query(`DELETE FROM lake_gallery_photos WHERE id = $1`, [photoId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Неуспешно изтриване на снимката от галерията" });
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
  getUserReports,
  updateUserReport,
  deleteUserReport,
  getCatchLogs,
  deleteCatchLog,
  getGalleryPhotos,
  deleteGalleryPhoto,
};