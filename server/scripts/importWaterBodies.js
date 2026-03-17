const axios = require("axios");
const pool = require("../db");

const OVERPASS_URL =
  process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

const BOXES = {
  NW: { south: 43.6, west: 22.0, north: 44.4, east: 24.4 },
  NE: { south: 43.6, west: 24.4, north: 44.4, east: 28.8 },
  CW: { south: 42.7, west: 22.0, north: 43.6, east: 24.4 },
  CE: { south: 42.7, west: 24.4, north: 43.6, east: 28.8 },
  SW: { south: 41.9, west: 22.0, north: 42.7, east: 24.4 },
  SE: { south: 41.9, west: 24.4, north: 42.7, east: 28.8 },
};

const TILE_NAME = (process.argv[2] || "NW").toUpperCase();

const buildQuery = ({ south, west, north, east }) => `
[out:json][timeout:90];
(
  way["water"="lake"]["name"](${south},${west},${north},${east});
  relation["water"="lake"]["name"](${south},${west},${north},${east});
  way["water"="reservoir"]["name"](${south},${west},${north},${east});
  relation["water"="reservoir"]["name"](${south},${west},${north},${east});
);
out tags geom;
`;

const closeRing = (coords) => {
  if (coords.length < 3) return null;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...coords, first];
  }
  return coords;
};

const inferType = (tags = {}) => {
  const water = String(tags.water || "").toLowerCase();
  if (water === "lake") return "lake";
  if (water === "reservoir") return "reservoir";
  return "lake";
};

const pickBestName = (tags = {}, fallbackId = "") => {
  const candidates = [
    tags["name:bg"],
    tags["official_name:bg"],
    tags["loc_name:bg"],
    tags["alt_name:bg"],
    tags["old_name:bg"],
    tags.name,
    tags["official_name"],
    tags["loc_name"],
    tags["alt_name"],
    tags["int_name"],
  ];

  for (const value of candidates) {
    const text = String(value || "").trim();
    if (text) return text;
  }

  return `Unnamed ${fallbackId}`;
};

const buildGeometryFromElement = (el) => {
  if (!Array.isArray(el.geometry) || el.geometry.length < 3) return null;

  const coords = el.geometry.map((p) => [p.lon, p.lat]);
  const ring = closeRing(coords);
  if (!ring || ring.length < 4) return null;

  return {
    type: "Polygon",
    coordinates: [ring],
  };
};

async function insertElement(el) {
  const geometry = buildGeometryFromElement(el);
  if (!geometry) return { inserted: 0, skipped: 1 };

  const osmType = el.type;
  const osmId = String(el.id);
  const name = pickBestName(el.tags || {}, `${osmType} ${osmId}`);
  const type = inferType(el.tags || {});
  const geojsonText = JSON.stringify(geometry);

  if (!name || name.startsWith("Unnamed ")) {
    return { inserted: 0, skipped: 1 };
  }

  const exists = await pool.query(
    `
    SELECT id
    FROM water_bodies
    WHERE LOWER(name) = LOWER($1)
       OR description = $2
    LIMIT 1
    `,
    [name, `Imported from OpenStreetMap (${osmType} ${osmId})`]
  );

  if (exists.rows.length) {
    return { inserted: 0, skipped: 1 };
  }

  await pool.query(
    `
    INSERT INTO water_bodies
    (
      id,
      name,
      description,
      type,
      is_private,
      owner_id,
      lat,
      lng,
      geom,
      price_per_day,
      capacity,
      is_reservable,
      availability_notes,
      created_at,
      updated_at
    )
    VALUES
    (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      false,
      NULL,
      ST_Y(ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))),
      ST_X(ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))),
      ST_SetSRID(ST_GeomFromGeoJSON($4), 4326),
      0,
      0,
      false,
      NULL,
      NOW(),
      NOW()
    )
    `,
    [
      name,
      `Imported from OpenStreetMap (${osmType} ${osmId})`,
      type,
      geojsonText,
    ]
  );

  return { inserted: 1, skipped: 0 };
}

async function runImport() {
  try {
    const box = BOXES[TILE_NAME];

    if (!box) {
      console.error("Invalid tile. Use one of: NW, NE, CW, CE, SW, SE");
      process.exit(1);
    }

    console.log(`Fetching tile ${TILE_NAME}...`);

    const query = buildQuery(box);

    const response = await axios.post(OVERPASS_URL, query, {
      headers: { "Content-Type": "text/plain" },
      timeout: 180000,
    });

    const elements = response.data.elements || [];
    let inserted = 0;
    let skipped = 0;

    console.log(`Tile ${TILE_NAME}: ${elements.length} elements`);

    for (const el of elements) {
      const result = await insertElement(el);
      inserted += result.inserted;
      skipped += result.skipped;
    }

    console.log(`Tile ${TILE_NAME} complete. Inserted: ${inserted}, Skipped: ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error("Import error:", err.response?.data || err.message);
    process.exit(1);
  }
}

runImport();