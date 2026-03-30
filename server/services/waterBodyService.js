const pool = require("../db");

const BASE_FIELDS_SQL = `
  id,
  name,
  type,
  is_private,
  owner_id,
  price_per_day,
  capacity,
  is_reservable,
  availability_notes,
  dedupe_key
`;

const ORDER_PRIORITY_SQL = `
  CASE
    WHEN type IN ('lake', 'reservoir') THEN 0
    ELSE 1
  END
`;

const GEOMETRY_SIMPLIFICATION_SQL = `
  CASE
    WHEN $5::numeric >= 15 THEN 0.00003
    WHEN $5::numeric >= 14 THEN 0.00008
    WHEN $5::numeric >= 13 THEN 0.00018
    WHEN $5::numeric >= 12 THEN 0.00045
    ELSE 0.00100
  END
`;

const LOW_ZOOM_MARKER_CUTOFF = 11;

const getAllWaterBodies = async () => {
  const q = await pool.query(`
    SELECT
      ${BASE_FIELDS_SQL},
      description,
      CASE
        WHEN geom IS NOT NULL THEN ST_AsGeoJSON(geom)::json
        ELSE NULL
      END AS boundary,
      latitude,
      longitude
    FROM water_bodies_map_mv
    ORDER BY
      ${ORDER_PRIORITY_SQL},
      CASE WHEN geom IS NOT NULL THEN 0 ELSE 1 END,
      updated_at DESC NULLS LAST,
      created_at DESC NULLS LAST,
      id
  `);

  return q.rows;
};

const searchWaterBodies = async (query) => {
  const trimmed = String(query || "").trim();

  const q = await pool.query(
    `
      SELECT
        ${BASE_FIELDS_SQL},
        description,
        NULL AS boundary,
        latitude,
        longitude
      FROM water_bodies_map_mv
      WHERE
        (
          name ILIKE $1
          OR description ILIKE $1
          OR type ILIKE $1
        )
        AND is_private = TRUE
      ORDER BY
        CASE
          WHEN LOWER(TRIM(name)) = LOWER(TRIM($2)) THEN 0
          WHEN LOWER(name) LIKE LOWER($3) THEN 1
          ELSE 2
        END,
        ${ORDER_PRIORITY_SQL},
        CASE WHEN geom IS NOT NULL THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id
      LIMIT 25
    `,
    [`%${trimmed}%`, trimmed, `${trimmed}%`],
  );

  return q.rows;
};

const getWaterBodiesInBounds = async ({
  west,
  south,
  east,
  north,
  zoom,
  q,
  sortBy,
  userLat,
  userLng,
  distanceKm,
}) => {
  const parsedWest = Number(west);
  const parsedSouth = Number(south);
  const parsedEast = Number(east);
  const parsedNorth = Number(north);
  const parsedZoom = Number(zoom);
  const parsedUserLat =
    userLat === undefined || userLat === null || userLat === ""
      ? null
      : Number(userLat);
  const parsedUserLng =
    userLng === undefined || userLng === null || userLng === ""
      ? null
      : Number(userLng);
  const parsedDistanceKm =
    distanceKm === undefined ||
    distanceKm === null ||
    distanceKm === "" ||
    distanceKm === "ALL"
      ? null
      : Number(distanceKm);

  if (
    ![parsedWest, parsedSouth, parsedEast, parsedNorth, parsedZoom].every(
      Number.isFinite,
    )
  ) {
    throw new Error("Invalid bounds or zoom passed to getWaterBodiesInBounds");
  }

  const minWest = Math.min(parsedWest, parsedEast);
  const maxEast = Math.max(parsedWest, parsedEast);
  const minSouth = Math.min(parsedSouth, parsedNorth);
  const maxNorth = Math.max(parsedSouth, parsedNorth);

  const hasUserLocation =
    Number.isFinite(parsedUserLat) && Number.isFinite(parsedUserLng);

  const trimmedQuery = String(q || "").trim();
  const normalizedSortBy = String(sortBy || "default").trim().toLowerCase();
  const useMarkerView = parsedZoom < LOW_ZOOM_MARKER_CUTOFF;

  const params = [
    minWest,
    minSouth,
    maxEast,
    maxNorth,
    parsedZoom,
    trimmedQuery || null,
    hasUserLocation ? parsedUserLat : null,
    hasUserLocation ? parsedUserLng : null,
    parsedDistanceKm,
  ];

  const sourceView = useMarkerView
    ? "water_bodies_marker_mv"
    : "water_bodies_map_mv";

  const sourceHasGeom = !useMarkerView;

  const sourceBoundingCondition = sourceHasGeom
    ? `
        (
          (
            wb.geom IS NOT NULL
            AND wb.geom && e.geom
            AND ST_Intersects(wb.geom, e.geom)
          )
          OR (
            wb.geom IS NULL
            AND wb.longitude IS NOT NULL
            AND wb.latitude IS NOT NULL
            AND wb.longitude BETWEEN $1 AND $3
            AND wb.latitude BETWEEN $2 AND $4
          )
        )
      `
    : `
        wb.longitude IS NOT NULL
        AND wb.latitude IS NOT NULL
        AND wb.longitude BETWEEN $1 AND $3
        AND wb.latitude BETWEEN $2 AND $4
      `;

  const boundarySelectSql = sourceHasGeom
    ? `
        CASE
          WHEN $5::numeric >= 11 AND geom IS NOT NULL
            THEN ST_AsGeoJSON(
              ST_SimplifyPreserveTopology(geom, ${GEOMETRY_SIMPLIFICATION_SQL})
            )::json
          ELSE NULL
        END AS boundary,
      `
    : `
        NULL AS boundary,
      `;

  const descriptionSelectSql = useMarkerView
    ? `
        CASE
          WHEN $5::numeric >= 9 THEN description
          ELSE NULL
        END AS description,
      `
    : `
        CASE
          WHEN $5::numeric >= 9 THEN description
          ELSE NULL
        END AS description,
      `;

  const geomOrderSql = sourceHasGeom
    ? `CASE WHEN geom IS NOT NULL THEN 0 ELSE 1 END,`
    : "";

  const limitSql = useMarkerView
    ? `
        CASE
          WHEN $5::numeric < 8 THEN 100
          WHEN $5::numeric < 10 THEN 160
          ELSE 220
        END
      `
    : `
        CASE
          WHEN $5::numeric < 12 THEN 220
          WHEN $5::numeric < 14 THEN 320
          ELSE 420
        END
      `;

  const qResult = await pool.query(
    `
      WITH envelope AS (
        SELECT ST_MakeEnvelope($1, $2, $3, $4, 4326) AS geom
      ),
      filtered_rows AS (
        SELECT
          wb.*,
          CASE
            WHEN $7::numeric IS NOT NULL
              AND $8::numeric IS NOT NULL
              AND wb.latitude IS NOT NULL
              AND wb.longitude IS NOT NULL
            THEN ST_DistanceSphere(
              ST_MakePoint(wb.longitude, wb.latitude),
              ST_MakePoint($8, $7)
            ) / 1000.0
            ELSE NULL
          END AS distance_km
        FROM ${sourceView} wb
        CROSS JOIN envelope e
        WHERE
          ${sourceBoundingCondition}
          AND (
            $6::text IS NULL
            OR wb.name ILIKE '%' || $6 || '%'
            OR wb.description ILIKE '%' || $6 || '%'
            OR wb.type ILIKE '%' || $6 || '%'
          )
      )
      SELECT
        ${BASE_FIELDS_SQL},
        ${descriptionSelectSql}
        ${boundarySelectSql}
        latitude,
        longitude,
        distance_km
      FROM filtered_rows
      WHERE
        (
          $9::numeric IS NULL
          OR (distance_km IS NOT NULL AND distance_km <= $9::numeric)
        )
      ORDER BY
        CASE
          WHEN $6::text IS NOT NULL AND LOWER(TRIM(name)) = LOWER(TRIM($6)) THEN 0
          WHEN $6::text IS NOT NULL AND LOWER(name) LIKE LOWER($6 || '%') THEN 1
          ELSE 2
        END,
        CASE
          WHEN $7::numeric IS NOT NULL
            AND $8::numeric IS NOT NULL
            AND $6::text IS NULL
            AND '${normalizedSortBy}' = 'nearest'
          THEN distance_km
          ELSE NULL
        END ASC NULLS LAST,
        ${ORDER_PRIORITY_SQL},
        ${geomOrderSql}
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id
      LIMIT ${limitSql}
    `,
    params,
  );

  return qResult.rows;
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
        dedupe_key,
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
        display_lat AS latitude,
        display_lng AS longitude
      FROM water_bodies
      WHERE id = $1
    `,
    [waterBodyId],
  );

  return q.rows[0] || null;
};

const getWaterBodyCentroid = async (waterBodyId) => {
  const q = await pool.query(
    `
      SELECT
        display_lat AS latitude,
        display_lng AS longitude
      FROM water_bodies
      WHERE id = $1
    `,
    [waterBodyId],
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