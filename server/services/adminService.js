const pool = require("../db");

const getAdminAnalytics = async () => {
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

  return {
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
  };
};

module.exports = {
  getAdminAnalytics,
};