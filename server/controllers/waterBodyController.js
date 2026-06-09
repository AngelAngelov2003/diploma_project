const pool = require("../db");
const waterBodyService = require("../services/waterBodyService");
const { fetchForecastForLatLng, fetchWeeklyForecastForLatLng } = require("../services/forecastService");
const { ensureReservationDomainTables } = require("../setup/ensureTables");

const getWaterBodies = async (req, res) => {
  try {
    const rows = await waterBodyService.getAllWaterBodies();
    res.json(rows);
  } catch (err) {
    console.error("getWaterBodies error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на водоемите" });
  }
};

const getWaterBodiesInBounds = async (req, res) => {
  try {
    const west = Number(req.query.west);
    const south = Number(req.query.south);
    const east = Number(req.query.east);
    const north = Number(req.query.north);
    const zoom = Number(req.query.zoom || 0);

    if (![west, south, east, north, zoom].every(Number.isFinite)) {
      return res.status(400).json({ error: "Невалидни граници" });
    }

    const rows = await waterBodyService.getWaterBodiesInBounds({
      west,
      south,
      east,
      north,
      zoom,
      q: req.query.q || "",
      sortBy: req.query.sortBy || "default",
      userLat: req.query.userLat,
      userLng: req.query.userLng,
      distanceKm: req.query.distanceKm,
      regionGeoJson: req.query.regionGeoJson,
    });

    res.json(rows);
  } catch (err) {
    console.error("getWaterBodiesInBounds error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на водоемите в избраните граници" });
  }
};

const getForecastByLatLng = async (req, res) => {
  const { lat, lng } = req.params;

  try {
    const result = await fetchForecastForLatLng(lat, lng);
    res.json(result);
  } catch (err) {
    console.error("getForecastByLatLng error:", err);
    const status = err.status || 500;
    res.status(status).json({
      error: err.publicMessage || err.message || "Няма данни за времето",
      code: err.code || "FORECAST_ERROR",
    });
  }
};

const getWeeklyForecastByLatLng = async (req, res) => {
  const { lat, lng } = req.params;

  try {
    const result = await fetchWeeklyForecastForLatLng(lat, lng);
    res.json(result);
  } catch (err) {
    console.error("getWeeklyForecastByLatLng error:", err);
    const status = err.status || 500;
    res.status(status).json({
      error: err.publicMessage || err.message || "Неуспешно зареждане на седмичната прогноза",
      code: err.code || "FORECAST_ERROR",
    });
  }
};

const getWaterBodyWeeklyForecast = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const coords = await waterBodyService.getWaterBodyCentroid(waterBodyId);

    if (!coords) {
      return res.status(404).json({ error: "Водоемът не е намерен" });
    }

    const lat = Number(coords.latitude);
    const lng = Number(coords.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Координатите на водоема не са налични" });
    }

    const forecast = await fetchWeeklyForecastForLatLng(lat, lng);
    res.json(forecast);
  } catch (err) {
    console.error("getWaterBodyWeeklyForecast error:", err);
    const status = err.status || 500;
    res.status(status).json({
      error: err.publicMessage || err.message || "Неуспешно зареждане на седмичната прогноза",
      code: err.code || "FORECAST_ERROR",
    });
  }
};

const getWaterBodyById = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const waterBody = await waterBodyService.getWaterBodyById(waterBodyId);

    if (!waterBody) {
      return res.status(404).json({ error: "Водоемът не е намерен" });
    }

    res.json(waterBody);
  } catch (err) {
    console.error("getWaterBodyById error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на данните за водоема" });
  }
};

const getWaterBodyForecast = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const coords = await waterBodyService.getWaterBodyCentroid(waterBodyId);

    if (!coords) {
      return res.status(404).json({ error: "Водоемът не е намерен" });
    }

    const lat = Number(coords.latitude);
    const lng = Number(coords.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Координатите на водоема не са налични" });
    }

    const forecast = await fetchForecastForLatLng(lat, lng);
    res.json(forecast);
  } catch (err) {
    console.error("getWaterBodyForecast error:", err);
    const status = err.status || 500;
    res.status(status).json({
      error: err.publicMessage || err.message || "Неуспешно зареждане на прогнозата",
      code: err.code || "FORECAST_ERROR",
    });
  }
};

const getWaterBodyCatches = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    const q = await pool.query(
      `
        SELECT
          c.id,
          c.species,
          c.weight_kg,
          c.image_url,
          c.catch_time,
          c.notes,
          c.temperature,
          c.pressure,
          c.wind_speed,
          c.humidity,
          c.moon_phase,
          c.created_at,
          u.full_name
        FROM catch_logs c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.water_body_id = $1
        ORDER BY COALESCE(c.catch_time, c.created_at) DESC
        LIMIT 20
      `,
      [waterBodyId]
    );

    res.json(q.rows);
  } catch (err) {
    console.error("getWaterBodyCatches error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на последните улови" });
  }
};

const searchWaterBodies = async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.json([]);
    }

    const rows = await waterBodyService.searchWaterBodies(query);
    res.json(rows);
  } catch (err) {
    console.error("searchWaterBodies error:", err);
    res.status(500).json({ error: "Неуспешно търсене на водоеми" });
  }
};

const getSpeciesSummary = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    const q = await pool.query(
      `
        SELECT
          species,
          COUNT(*)::int AS catches_count,
          ROUND(AVG(weight_kg)::numeric, 2) AS avg_weight_kg,
          ROUND(MAX(weight_kg)::numeric, 2) AS max_weight_kg
        FROM catch_logs
        WHERE water_body_id = $1
          AND species IS NOT NULL
          AND TRIM(species) <> ''
        GROUP BY species
        ORDER BY catches_count DESC, species ASC
      `,
      [waterBodyId]
    );

    res.json(q.rows);
  } catch (err) {
    console.error("getSpeciesSummary error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на обобщението по видове" });
  }
};

const getWaterBodyPhotos = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    const q = await pool.query(
      `
        SELECT
          id,
          image_url,
          caption,
          sort_order,
          created_at,
          'owner_gallery'::text AS photo_source
        FROM lake_gallery_photos
        WHERE water_body_id = $1
        ORDER BY sort_order ASC, created_at DESC NULLS LAST
        LIMIT 24
      `,
      [waterBodyId]
    );

    res.json(q.rows);
  } catch (err) {
    console.error("getWaterBodyPhotos error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на снимките" });
  }
};

const getReviews = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    const q = await pool.query(
      `
        SELECT
          r.id,
          r.rating,
          r.comment,
          r.created_at,
          u.full_name
        FROM water_body_reviews r
        JOIN users u ON u.id = r.user_id
        WHERE r.water_body_id = $1
        ORDER BY r.created_at DESC
      `,
      [waterBodyId]
    );

    res.json(q.rows);
  } catch (err) {
    console.error("getReviews error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на отзивите" });
  }
};

const getReviewsSummary = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    const q = await pool.query(
      `
        SELECT
          COUNT(*)::int AS reviews_count,
          ROUND(AVG(rating)::numeric, 2) AS average_rating
        FROM water_body_reviews
        WHERE water_body_id = $1
      `,
      [waterBodyId]
    );

    res.json(q.rows[0] || { reviews_count: 0, average_rating: null });
  } catch (err) {
    console.error("getReviewsSummary error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на обобщението на отзивите" });
  }
};

const upsertReview = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const { rating, comment } = req.body;

    const parsedRating = Number(rating);
    const trimmedComment = String(comment || "").trim();

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "Оценката трябва да бъде цяло число между 1 и 5" });
    }

    const q = await pool.query(
      `
        INSERT INTO water_body_reviews (water_body_id, user_id, rating, comment)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (water_body_id, user_id) DO UPDATE
        SET
          rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          created_at = NOW()
        RETURNING *
      `,
      [waterBodyId, req.user, parsedRating, trimmedComment || null]
    );

    res.json(q.rows[0]);
  } catch (err) {
    console.error("upsertReview error:", err);
    res.status(500).json({ error: "Неуспешно запазване на отзива" });
  }
};

const deleteMyReview = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    await pool.query(
      `
        DELETE FROM water_body_reviews
        WHERE water_body_id = $1 AND user_id = $2
      `,
      [waterBodyId, req.user]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("deleteMyReview error:", err);
    res.status(500).json({ error: "Неуспешно изтриване на отзива" });
  }
};


const getBookingOptions = async (req, res) => {
  try {
    await ensureReservationDomainTables();
    const { waterBodyId } = req.params;

    const lakeQ = await pool.query(`
      SELECT
        id,
        is_private,
        is_reservable,
        price_per_day,
        capacity,
        allows_night_fishing,
        night_fishing_price,
        has_housing,
        availability_notes
      FROM water_bodies
      WHERE id = $1
      LIMIT 1
    `, [waterBodyId]);

    if (!lakeQ.rows.length) {
      return res.status(404).json({ error: "Водоемът не е намерен" });
    }

    const [sectorsQ, roomsQ, spotsQ] = await Promise.all([
      pool.query(`SELECT id, name, spots_count, price_per_day, night_fishing_allowed, is_active, sort_order FROM lake_sectors WHERE water_body_id = $1 AND is_active = TRUE ORDER BY sort_order ASC, name ASC`, [waterBodyId]),
      pool.query(`SELECT id, name, capacity, price_per_night, is_active, sort_order FROM lake_rooms WHERE water_body_id = $1 AND is_active = TRUE ORDER BY sort_order ASC, name ASC`, [waterBodyId]),
      pool.query(`SELECT id, spot_number, is_active FROM lake_spots WHERE water_body_id = $1 AND is_active = TRUE ORDER BY spot_number ASC`, [waterBodyId]),
    ]);

    res.json({
      lake: lakeQ.rows[0],
      sectors: sectorsQ.rows,
      rooms: roomsQ.rows,
      spots: spotsQ.rows,
    });
  } catch (err) {
    console.error("getBookingOptions error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на опциите за резервация" });
  }
};


const getAvailability = async (req, res) => {
  try {
    await ensureReservationDomainTables();
    const { waterBodyId } = req.params;
    const startDate = String(req.query.start_date || req.query.arrival_date || "").trim();
    const endDate = String(req.query.end_date || req.query.departure_date || startDate || "").trim();

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "start_date и end_date са задължителни" });
    }

    if (new Date(`${endDate}T00:00:00Z`) < new Date(`${startDate}T00:00:00Z`)) {
      return res.status(400).json({ error: "Крайната дата трябва да бъде след или равна на началната дата" });
    }

    const lakeQ = await pool.query(`
      SELECT id, is_private, is_reservable, capacity, spots_count, has_housing
      FROM water_bodies
      WHERE id = $1
      LIMIT 1
    `, [waterBodyId]);

    if (!lakeQ.rows.length) {
      return res.status(404).json({ error: "Водоемът не е намерен" });
    }

    const lake = lakeQ.rows[0];
    const activeStatuses = ["pending", "approved"];

    const [spotsQ, reservedSpotsQ, reservedSpotCountQ, roomsQ, reservedRoomsQ, blockedDatesQ] = await Promise.all([
      pool.query(`
        SELECT id, spot_number, is_active
        FROM lake_spots
        WHERE water_body_id = $1
        ORDER BY spot_number ASC
      `, [waterBodyId]),
      pool.query(`
        SELECT DISTINCT rs.spot_id::text AS spot_id
        FROM reservation_spots rs
        JOIN lake_reservations r ON r.id = rs.reservation_id
        WHERE r.water_body_id = $1
          AND daterange(r.start_date::date, (r.end_date::date + 1)::date, '[)') && daterange($2::date, ($3::date + 1)::date, '[)')
          AND r.status = ANY($4::text[])
      `, [waterBodyId, startDate, endDate, activeStatuses]),
      pool.query(`
        SELECT COALESCE(SUM(r.requested_spots), 0)::int AS reserved_spots
        FROM lake_reservations r
        WHERE r.water_body_id = $1
          AND daterange(r.start_date::date, (r.end_date::date + 1)::date, '[)') && daterange($2::date, ($3::date + 1)::date, '[)')
          AND r.status = ANY($4::text[])
      `, [waterBodyId, startDate, endDate, activeStatuses]),
      pool.query(`
        SELECT id, name, capacity, price_per_night, is_active, sort_order
        FROM lake_rooms
        WHERE water_body_id = $1
        ORDER BY sort_order ASC, name ASC
      `, [waterBodyId]),
      pool.query(`
        SELECT DISTINCT rrm.room_id::text AS room_id
        FROM lake_reservation_rooms rrm
        JOIN lake_reservations r ON r.id = rrm.reservation_id
        WHERE r.water_body_id = $1
          AND daterange(r.start_date::date, (r.end_date::date + 1)::date, '[)') && daterange($2::date, ($3::date + 1)::date, '[)')
          AND r.status = ANY($4::text[])
      `, [waterBodyId, startDate, endDate, activeStatuses]),
      pool.query(`
        SELECT id, blocked_date::text AS blocked_date, reason
        FROM lake_blocked_dates
        WHERE water_body_id = $1
          AND blocked_date BETWEEN $2 AND $3
        ORDER BY blocked_date ASC
      `, [waterBodyId, startDate, endDate]),
    ]);

    const reservedSpotIds = new Set(reservedSpotsQ.rows.map((row) => row.spot_id));
    const reservedRoomIds = new Set(reservedRoomsQ.rows.map((row) => row.room_id));
    const totalSpots = Math.max(1, Number(lake.spots_count || lake.capacity || spotsQ.rows.length || 1));
    const reservedSpotCount = Number(reservedSpotCountQ.rows[0]?.reserved_spots || 0);
    const remainingSpotCapacity = Math.max(0, totalSpots - reservedSpotCount);

    const spots = spotsQ.rows.map((spot) => ({
      ...spot,
      is_reserved: reservedSpotIds.has(String(spot.id)),
      is_available: Boolean(spot.is_active) && !reservedSpotIds.has(String(spot.id)),
    }));

    const rooms = roomsQ.rows.map((room) => ({
      ...room,
      is_reserved: reservedRoomIds.has(String(room.id)),
      is_available: Boolean(room.is_active) && !reservedRoomIds.has(String(room.id)),
    }));

    res.json({
      lake: {
        is_private: lake.is_private,
        is_reservable: lake.is_reservable,
        total_spots: totalSpots,
        reserved_spots: reservedSpotCount,
        remaining_spot_capacity: remainingSpotCapacity,
      },
      range: {
        start_date: startDate,
        end_date: endDate,
      },
      blocked_dates: blockedDatesQ.rows,
      spots,
      rooms,
    });
  } catch (err) {
    console.error("getAvailability error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на наличността" });
  }
};


const getUnavailableDates = async (req, res) => {
  try {
    await ensureReservationDomainTables();
    const { waterBodyId } = req.params;
    const startDate = String(req.query.start_date || "").trim();
    const endDate = String(req.query.end_date || "").trim();

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "start_date и end_date са задължителни" });
    }

    if (new Date(`${endDate}T00:00:00Z`) < new Date(`${startDate}T00:00:00Z`)) {
      return res.status(400).json({ error: "Крайната дата трябва да бъде след или равна на началната дата" });
    }

    const q = await pool.query(`
      WITH lake AS (
        SELECT id, GREATEST(1, COALESCE(spots_count, capacity, 1))::int AS total_spots
        FROM water_bodies
        WHERE id = $1
        LIMIT 1
      ),
      days AS (
        SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
      ),
      reserved AS (
        SELECT
          d.day,
          COALESCE(SUM(r.requested_spots), 0)::int AS reserved_spots
        FROM days d
        LEFT JOIN lake_reservations r
          ON r.water_body_id = $1
         AND r.status = ANY($4::text[])
         AND daterange(r.start_date::date, (r.end_date::date + 1)::date, '[)') && daterange(d.day, (d.day + 1)::date, '[)')
        GROUP BY d.day
      ),
      blocked AS (
        SELECT blocked_date::date AS day
        FROM lake_blocked_dates
        WHERE water_body_id = $1
          AND blocked_date BETWEEN $2::date AND $3::date
      )
      SELECT
        d.day::text AS date,
        CASE
          WHEN EXISTS (SELECT 1 FROM blocked b WHERE b.day = d.day) THEN true
          WHEN COALESCE(r.reserved_spots, 0) >= COALESCE((SELECT total_spots FROM lake), 1) THEN true
          ELSE false
        END AS unavailable,
        COALESCE((SELECT total_spots FROM lake), 1)::int AS total_spots,
        COALESCE(r.reserved_spots, 0)::int AS reserved_spots,
        GREATEST(0, COALESCE((SELECT total_spots FROM lake), 1) - COALESCE(r.reserved_spots, 0))::int AS remaining_spots
      FROM days d
      LEFT JOIN reserved r ON r.day = d.day
      ORDER BY d.day ASC
    `, [waterBodyId, startDate, endDate, ["pending", "approved"]]);

    res.json({
      range: { start_date: startDate, end_date: endDate },
      dates: q.rows,
      unavailable_dates: q.rows.filter((row) => row.unavailable).map((row) => row.date),
    });
  } catch (err) {
    console.error("getUnavailableDates error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на недостъпните дати" });
  }
};

const getBlockedDates = async (req, res) => {
  try {
    const { waterBodyId } = req.params;

    const q = await pool.query(
      `
        SELECT id, water_body_id, blocked_date, reason, created_at
        FROM lake_blocked_dates
        WHERE water_body_id = $1
        ORDER BY blocked_date ASC
      `,
      [waterBodyId]
    );

    res.json(q.rows);
  } catch (err) {
    console.error("getBlockedDates error:", err);
    res.status(500).json({ error: "Неуспешно зареждане на блокираните дати" });
  }
};

module.exports = {
  getWaterBodies,
  getWaterBodiesInBounds,
  searchWaterBodies,
  getForecastByLatLng,
  getWeeklyForecastByLatLng,
  getWaterBodyById,
  getWaterBodyForecast,
  getWaterBodyWeeklyForecast,
  getWaterBodyCatches,
  getSpeciesSummary,
  getWaterBodyPhotos,
  getBookingOptions,
  getAvailability,
  getUnavailableDates,
  getReviews,
  getReviewsSummary,
  upsertReview,
  deleteMyReview,
  getBlockedDates,
};