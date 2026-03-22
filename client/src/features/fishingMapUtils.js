import React from "react";
import L from "leaflet";

export const BULGARIA_CENTER = [42.7339, 25.4858];
export const BULGARIA_ZOOM = 7;
export const MIN_DISTANCE_KM = 5;
export const MAX_DISTANCE_KM = 200;
export const DEFAULT_DISTANCE_KM = 100;
export const GEOMETRY_MIN_ZOOM = 11;

export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const highlightText = (text, query) => {
  const t = String(text || "");
  const q = String(query || "").trim();
  if (!q) return t;

  const re = new RegExp(escapeRegExp(q), "ig");
  const parts = [];
  let lastIndex = 0;

  t.replace(re, (match, offset) => {
    parts.push(t.slice(lastIndex, offset));
    parts.push(
      <mark
        key={`${offset}-${match}`}
        style={{
          background: "#dbeafe",
          color: "#1d4ed8",
          padding: "0 4px",
          borderRadius: "6px",
        }}
      >
        {t.slice(offset, offset + match.length)}
      </mark>,
    );
    lastIndex = offset + match.length;
    return match;
  });

  parts.push(t.slice(lastIndex));
  return parts;
};

export const getDisplayDescription = (text) => {
  const value = String(text || "").trim();
  if (!value) return "";
  if (value.toLowerCase().startsWith("imported from openstreetmap")) return "";
  return value;
};

export const truncate = (text, max = 90) => {
  const value = String(text || "").trim();
  if (!value) return "No description available.";
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
};

export const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getDistanceMeters = (lat1, lon1, lat2, lon2) =>
  getDistanceKm(lat1, lon1, lat2, lon2) * 1000;

export const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(1)} km away`;
};

export const getGeometryType = (geometry) => geometry?.type || null;

export const hasRenderableGeometry = (geometry) => {
  const type = getGeometryType(geometry);
  return ["Polygon", "MultiPolygon", "LineString", "MultiLineString"].includes(
    type,
  );
};

export const shouldRenderGeometryByZoom = (zoom) => zoom >= GEOMETRY_MIN_ZOOM;

export const formatWaterBodyType = (type) => {
  const value = String(type || "")
    .trim()
    .toLowerCase();
  if (!value) return "Water body";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const shouldShowMarker = (lake) =>
  Number.isFinite(Number(lake?.latitude)) &&
  Number.isFinite(Number(lake?.longitude));

export const getSortableLakeName = (name) =>
  String(name || "")
    .trim()
    .replace(/^(?:\([^)]*\)\s*)+/u, "")
    .replace(/^[^0-9A-Za-zА-Яа-я]+/u, "")
    .trim()
    .toLocaleLowerCase("bg");

const GENERIC_NAME_PATTERNS = [
  /^lake$/i,
  /^reservoir$/i,
  /^water body$/i,
  /^яз\.?$/iu,
  /^язовир$/iu,
  /^езеро$/iu,
  /^изравнител$/iu,
];

const normalizeLakeName = (name) =>
  String(name || "")
    .toLocaleLowerCase("bg")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^язовир\s+/u, "")
    .replace(/^яз\.\s*/u, "")
    .replace(/^яз\s+/u, "")
    .replace(/^ezero\s+/iu, "")
    .replace(/^lake\s+/iu, "")
    .trim();

export const getLakeDisplayScore = (lake) => {
  const name = String(lake?.name || "").trim();
  const normalizedName = normalizeLakeName(name);
  const hasBoundary = hasRenderableGeometry(lake?.boundary);
  const hasDescription = Boolean(getDisplayDescription(lake?.description));
  const isReservoirOrLake = ["lake", "reservoir"].includes(
    String(lake?.type || "").toLowerCase(),
  );
  const isGenericName =
    GENERIC_NAME_PATTERNS.some((re) => re.test(name)) || normalizedName.length < 2;

  let score = 0;

  if (isReservoirOrLake) score += 50;
  if (hasBoundary) score += 30;
  if (hasDescription) score += 10;
  if (name) score += Math.min(name.length, 20);
  if (isGenericName) score -= 15;

  return score;
};

export const dedupeLakesByNearbyMarkerPosition = (
  lakes,
  thresholdMeters = 140,
) => {
  const sorted = [...lakes]
    .filter(
      (lake) =>
        Number.isFinite(Number(lake?.latitude)) &&
        Number.isFinite(Number(lake?.longitude)),
    )
    .sort((a, b) => getLakeDisplayScore(b) - getLakeDisplayScore(a));

  const chosen = [];

  const normalizeType = (value) =>
    String(value || "")
      .trim()
      .toLocaleLowerCase("bg");

  const isGenericLakeName = (name) => {
    const n = normalizeLakeName(name);
    return (
      !n ||
      n.length < 3 ||
      [
        "рибарник",
        "рибарници",
        "езеро",
        "ез.",
        "язовир",
        "яз.",
        "lake",
        "reservoir",
      ].includes(n)
    );
  };

  const isLikelySameLake = (a, b) => {
    const aLat = Number(a.latitude);
    const aLng = Number(a.longitude);
    const bLat = Number(b.latitude);
    const bLng = Number(b.longitude);

    if (
      !Number.isFinite(aLat) ||
      !Number.isFinite(aLng) ||
      !Number.isFinite(bLat) ||
      !Number.isFinite(bLng)
    ) {
      return false;
    }

    const distance = getDistanceMeters(aLat, aLng, bLat, bLng);
    const aName = normalizeLakeName(a.name);
    const bName = normalizeLakeName(b.name);
    const aType = normalizeType(a.type);
    const bType = normalizeType(b.type);

    const sameName = Boolean(aName && bName && aName === bName);
    const containsName =
      Boolean(aName && bName) &&
      (aName.includes(bName) || bName.includes(aName));
    const sameType = aType === bType;

    const aGeneric = isGenericLakeName(a.name);
    const bGeneric = isGenericLakeName(b.name);

    // Strict match for exact same nearby names
    if (sameName && distance <= 180) return true;

    // Slightly looser for longer, descriptive names
    if (
      containsName &&
      aName.length >= 6 &&
      bName.length >= 6 &&
      distance <= 140
    ) {
      return true;
    }

    // Very strict for generic names like "Рибарник", "езеро", etc.
    if (aGeneric && bGeneric && sameType && distance <= 70) {
      return true;
    }

    // Fallback: same exact normalized name + same type + very near
    if (sameName && sameType && distance <= thresholdMeters) {
      return true;
    }

    return false;
  };

  for (const lake of sorted) {
    const duplicate = chosen.some((picked) => isLikelySameLake(lake, picked));
    if (!duplicate) {
      chosen.push(lake);
    }
  }

  return chosen;
};

export const createLakeIcon = (selected) =>
  L.divIcon({
    className: "",
    html: `
      <div style="
        width: ${selected ? 24 : 20}px;
        height: ${selected ? 24 : 20}px;
        border-radius: 999px;
        background: ${
          selected
            ? "linear-gradient(135deg,#0f172a,#2563eb)"
            : "linear-gradient(135deg,#0d6efd,#38bdf8)"
        };
        border: 3px solid white;
        box-shadow: 0 10px 24px rgba(15,23,42,0.28);
        position: relative;
      ">
        <div style="
          position:absolute;
          left:50%;
          bottom:-8px;
          transform:translateX(-50%);
          width: 0;
          height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-top: 10px solid ${selected ? "#1d4ed8" : "#38bdf8"};
        "></div>
      </div>
    `,
    iconSize: [28, 34],
    iconAnchor: [14, 30],
    popupAnchor: [0, -30],
  });

export const createUserLocationIcon = () =>
  L.divIcon({
    className: "user-location-icon",
    html: `
      <div class="user-location-marker">
        <div class="user-location-pulse pulse-1"></div>
        <div class="user-location-pulse pulse-2"></div>
        <div class="user-location-core-ring"></div>
        <div class="user-location-core"></div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

export const createClusterCustomIcon = (cluster) => {
  const count = cluster.getChildCount();

  let size = 42;
  let fontSize = 13;

  if (count >= 10) {
    size = 48;
    fontSize = 14;
  }

  if (count >= 50) {
    size = 56;
    fontSize = 15;
  }

  if (count >= 100) {
    size = 64;
    fontSize = 16;
  }

  return L.divIcon({
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:999px;
        display:flex;
        align-items:center;
        justify-content:center;
        background: radial-gradient(circle at 30% 30%, #60a5fa 0%, #2563eb 70%, #1d4ed8 100%);
        border: 4px solid rgba(255,255,255,0.95);
        box-shadow: 0 14px 30px rgba(15,23,42,0.24);
        color: white;
        font-weight: 800;
        font-size:${fontSize}px;
      ">
        ${count}
      </div>
    `,
    className: "custom-marker-cluster",
    iconSize: L.point(size, size, true),
  });
};

export const getLocationErrorMessage = (error) => {
  if (!error) return "Unable to get your location";
  if (error.code === 1) return "Location access was denied";
  if (error.code === 2) return "Location is currently unavailable";
  if (error.code === 3) return "Location request timed out";
  return "Unable to get your location";
};

export const getGeoOptions = () => ({
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
});

const simplifyLine = (points, step) => {
  if (!Array.isArray(points) || points.length <= 4) return points;
  return points.filter(
    (point, index) =>
      index === 0 || index === points.length - 1 || index % step === 0,
  );
};

export const simplifyGeometry = (geometry, zoom) => {
  if (!geometry || !geometry.type) return geometry;

  const step = zoom >= 14 ? 1 : zoom >= 13 ? 2 : zoom >= 12 ? 3 : 5;

  try {
    if (geometry.type === "Polygon") {
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((ring) =>
          simplifyLine(ring, step),
        ),
      };
    }

    if (geometry.type === "MultiPolygon") {
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) =>
          polygon.map((ring) => simplifyLine(ring, step)),
        ),
      };
    }

    if (geometry.type === "LineString") {
      return {
        ...geometry,
        coordinates: simplifyLine(geometry.coordinates, step),
      };
    }

    if (geometry.type === "MultiLineString") {
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((line) =>
          simplifyLine(line, step),
        ),
      };
    }

    return geometry;
  } catch {
    return geometry;
  }
};