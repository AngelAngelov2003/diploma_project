const pool = require("../db");
const waterBodyService = require("../services/waterBodyService");
const { fetchForecastForLatLng } = require("../services/forecastService");

const getWaterBodies = async (req, res) => {
  try {
    const rows = await waterBodyService.getAllWaterBodies();
    res.json(rows);
  } catch (err) {
    console.error("getWaterBodies error:", err);
    res.status(500).json({ error: "Failed to load water bodies" });
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
      return res.status(400).json({ error: "Invalid bounds" });
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
    });

    res.json(rows);
  } catch (err) {
    console.error("getWaterBodiesInBounds error:", err);
    res.status(500).json({ error: "Failed to load water bodies in bounds" });
  }
};

const getForecastByLatLng = async (req, res) => {
  const { lat, lng } = req.params;

  try {
    const result = await fetchForecastForLatLng(lat, lng);
    res.json(result);
  } catch (err) {
    console.error("getForecastByLatLng error:", err);
    res.status(500).json({ error: "No weather data" });
  }
};

const getWaterBodyById = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const waterBody = await waterBodyService.getWaterBodyById(waterBodyId);

    if (!waterBody) {
      return res.status(404).json({ error: "Water body not found" });
    }

    res.json(waterBody);
  } catch (err) {
    console.error("getWaterBodyById error:", err);
    res.status(500).json({ error: "Failed to load water body details" });
  }
};

const getWaterBodyForecast = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const coords = await waterBodyService.getWaterBodyCentroid(waterBodyId);

    if (!coords) {
      return res.status(404).json({ error: "Water body not found" });
    }

    const lat = Number(coords.latitude);
    const lng = Number(coords.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Water body coordinates not available" });
    }

    const forecast = await fetchForecastForLatLng(lat, lng);
    res.json(forecast);
  } catch (err) {
    console.error("getWaterBodyForecast error:", err);
    res.status(500).json({ error: "Failed to load forecast" });
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
    res.status(500).json({ error: "Failed to load recent catches" });
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
    res.status(500).json({ error: "Failed to search water bodies" });
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
    res.status(500).json({ error: "Failed to load species summary" });
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
          species,
          weight_kg,
          catch_time,
          created_at
        FROM catch_logs
        WHERE water_body_id = $1
          AND image_url IS NOT NULL
          AND TRIM(image_url) <> ''
        ORDER BY COALESCE(catch_time, created_at) DESC
        LIMIT 24
      `,
      [waterBodyId]
    );

    res.json(q.rows);
  } catch (err) {
    console.error("getWaterBodyPhotos error:", err);
    res.status(500).json({ error: "Failed to load photos" });
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
    res.status(500).json({ error: "Failed to load reviews" });
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
    res.status(500).json({ error: "Failed to load review summary" });
  }
};

const upsertReview = async (req, res) => {
  try {
    const { waterBodyId } = req.params;
    const { rating, comment } = req.body;

    const parsedRating = Number(rating);
    const trimmedComment = String(comment || "").trim();

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
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
    res.status(500).json({ error: "Failed to save review" });
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
    res.status(500).json({ error: "Failed to delete review" });
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
    res.status(500).json({ error: "Failed to load blocked dates" });
  }
};

module.exports = {
  getWaterBodies,
  getWaterBodiesInBounds,
  searchWaterBodies,
  getForecastByLatLng,
  getWaterBodyById,
  getWaterBodyForecast,
  getWaterBodyCatches,
  getSpeciesSummary,
  getWaterBodyPhotos,
  getReviews,
  getReviewsSummary,
  upsertReview,
  deleteMyReview,
  getBlockedDates,
};