const pool = require("../db");

const getAllWaterBodies = async () => {
  const q = await pool.query(`
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
      CASE
        WHEN geom IS NOT NULL THEN ST_AsGeoJSON(geom)::json
        ELSE NULL
      END AS boundary,
      CASE
        WHEN geom IS NOT NULL THEN ST_Y(ST_Centroid(geom))
        ELSE lat
      END AS latitude,
      CASE
        WHEN geom IS NOT NULL THEN ST_X(ST_Centroid(geom))
        ELSE lng
      END AS longitude
    FROM water_bodies
    ORDER BY name ASC
  `);

  return q.rows;
};

const searchWaterBodies = async (query) => {
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
        CASE
          WHEN geom IS NOT NULL THEN ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001))::json
          ELSE NULL
        END AS boundary,
        CASE
          WHEN geom IS NOT NULL THEN ST_Y(ST_Centroid(geom))
          ELSE lat
        END AS latitude,
        CASE
          WHEN geom IS NOT NULL THEN ST_X(ST_Centroid(geom))
          ELSE lng
        END AS longitude
      FROM water_bodies
      WHERE
        name ILIKE $1
        OR description ILIKE $1
        OR type ILIKE $1
      ORDER BY
        CASE
          WHEN type IN ('lake', 'reservoir') THEN 0
          ELSE 1
        END,
        name ASC
      LIMIT 100
    `,
    [`%${query}%`]
  );

  return q.rows;
};

const getWaterBodiesInBounds = async ({ west, south, east, north, zoom }) => {
  const parsedWest = Number(west);
  const parsedSouth = Number(south);
  const parsedEast = Number(east);
  const parsedNorth = Number(north);
  const parsedZoom = Number(zoom);

  if (![parsedWest, parsedSouth, parsedEast, parsedNorth, parsedZoom].every(Number.isFinite)) {
    throw new Error("Invalid bounds or zoom passed to getWaterBodiesInBounds");
  }

  const minWest = Math.min(parsedWest, parsedEast);
  const maxEast = Math.max(parsedWest, parsedEast);
  const minSouth = Math.min(parsedSouth, parsedNorth);
  const maxNorth = Math.max(parsedSouth, parsedNorth);

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
        CASE
          WHEN $5::numeric >= 10 AND geom IS NOT NULL
            THEN ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001))::json
          ELSE NULL
        END AS boundary,
        CASE
          WHEN geom IS NOT NULL THEN ST_Y(ST_Centroid(geom))
          ELSE lat
        END AS latitude,
        CASE
          WHEN geom IS NOT NULL THEN ST_X(ST_Centroid(geom))
          ELSE lng
        END AS longitude
      FROM water_bodies
      WHERE geom IS NOT NULL
        AND ST_Intersects(
          geom,
          ST_MakeEnvelope($1, $2, $3, $4, 4326)
        )
      ORDER BY
        CASE
          WHEN type IN ('lake', 'reservoir') THEN 0
          ELSE 1
        END,
        name ASC
      LIMIT CASE
        WHEN $5::numeric < 8 THEN 300
        WHEN $5::numeric < 10 THEN 600
        ELSE 1200
      END
    `,
    [minWest, minSouth, maxEast, maxNorth, parsedZoom]
  );

  return q.rows;
};

const getWaterBodyById = async (waterBodyId) => {
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
        updated_at,
        CASE
          WHEN geom IS NOT NULL THEN ST_AsGeoJSON(geom)::json
          ELSE NULL
        END AS boundary,
        CASE
          WHEN geom IS NOT NULL THEN ST_Y(ST_Centroid(geom))
          ELSE lat
        END AS latitude,
        CASE
          WHEN geom IS NOT NULL THEN ST_X(ST_Centroid(geom))
          ELSE lng
        END AS longitude
      FROM water_bodies
      WHERE id = $1
    `,
    [waterBodyId]
  );

  return q.rows[0] || null;
};

const getWaterBodyCentroid = async (waterBodyId) => {
  const q = await pool.query(
    `
      SELECT
        CASE
          WHEN geom IS NOT NULL THEN ST_Y(ST_Centroid(geom))
          ELSE lat
        END AS latitude,
        CASE
          WHEN geom IS NOT NULL THEN ST_X(ST_Centroid(geom))
          ELSE lng
        END AS longitude
      FROM water_bodies
      WHERE id = $1
    `,
    [waterBodyId]
  );

  return q.rows[0] || null;
};

module.exports = {
  getAllWaterBodies,
  getWaterBodiesInBounds,
  searchWaterBodies,
  getWaterBodyById,
  getWaterBodyCentroid,
};