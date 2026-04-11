import React from "react";
import L from "leaflet";

export const BULGARIA_CENTER = [42.7339, 25.4858];
export const BULGARIA_ZOOM = 7;
export const DEFAULT_DISTANCE_KM = 100;
export const MIN_DISTANCE_KM = 5;
export const MAX_DISTANCE_KM = 200;

export const getSortableLakeName = (name) => {
  if (!name || typeof name !== "string") {
    return "zzzz";
  }

  return name
    .trim()
    .toLocaleLowerCase("bg")
    .replace(/^язовир\s+/i, "")
    .replace(/^езеро\s+/i, "")
    .replace(/^lake\s+/i, "");
};

export const getDistanceKm = (a, b) => {
  if (
    !a ||
    !b ||
    typeof a.lat !== "number" ||
    typeof a.lng !== "number" ||
    typeof b.lat !== "number" ||
    typeof b.lng !== "number"
  ) {
    return null;
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const haversine =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadiusKm * c;
};

export const hasRenderableGeometry = (lake) => {
  const boundary = lake?.boundary || lake;

  return Boolean(
    boundary &&
      boundary.type &&
      Array.isArray(boundary.coordinates) &&
      boundary.coordinates.length > 0,
  );
};

export const getDisplayDescription = (value) => {
  if (!value || typeof value !== "string") {
    return "No description available.";
  }

  const cleaned = value
    .replace(/^imported from openstreetmap[\s.:;-]*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "No description available.";
};

export const getGeoOptions = () => ({
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
});

export const getLocationErrorMessage = (error) => {
  switch (error?.code) {
    case 1:
      return "Location access was denied.";
    case 2:
      return "Your location could not be determined.";
    case 3:
      return "Location request timed out.";
    default:
      return "Unable to get your location.";
  }
};

export const shouldShowMarker = (lake, mapZoom = 0) => {
  if (!lake) {
    return false;
  }

  if (hasRenderableGeometry(lake)) {
    return mapZoom >= 9;
  }

  const latitude = Number(lake.latitude ?? lake.lat);
  const longitude = Number(lake.longitude ?? lake.lng);

  return Number.isFinite(latitude) && Number.isFinite(longitude);
};

export const truncate = (value, maxLength = 140) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}…`;
};

export const formatDistance = (distanceKm) => {
  if (typeof distanceKm !== "number" || Number.isNaN(distanceKm)) {
    return null;
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
};

export const formatWaterBodyType = (type) => {
  if (!type || typeof type !== "string") {
    return "Unknown";
  }

  return type
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const highlightText = (text, query) => {
  const safeText = text || "";
  const safeQuery = query?.trim();

  if (!safeQuery) {
    return safeText;
  }

  const escaped = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = safeText.split(new RegExp(`(${escaped})`, "gi"));

  return parts.map((part, index) =>
    part.toLowerCase() === safeQuery.toLowerCase() ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      part
    ),
  );
};

export const getRegionNameFromFeature = (feature) => {
  return (
    feature?.properties?.shapeName ||
    feature?.properties?.name ||
    feature?.properties?.NAME_1 ||
    feature?.properties?.adm1_en ||
    feature?.properties?.ADM1_EN ||
    "Region"
  );
};

const normalizeRegionRings = (geometry) => {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return [geometry.coordinates || []];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates || [];
  }
  return [];
};

const pointInRing = (pointLng, pointLat, ring) => {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);

    const intersects =
      ((yi > pointLat) !== (yj > pointLat)) &&
      (pointLng <
        ((xj - xi) * (pointLat - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const pointInPolygonGeometry = (pointLng, pointLat, geometry) => {
  const polygons = normalizeRegionRings(geometry);

  return polygons.some((polygonRings) => {
    if (!polygonRings?.length) return false;

    const [outerRing, ...holes] = polygonRings;

    if (!pointInRing(pointLng, pointLat, outerRing)) {
      return false;
    }

    return !holes.some((hole) => pointInRing(pointLng, pointLat, hole));
  });
};

export const findRegionFeatureByPoint = (featureCollection, location) => {
  const pointLat = Number(location?.latitude ?? location?.lat);
  const pointLng = Number(location?.longitude ?? location?.lng);

  if (
    !featureCollection?.features?.length ||
    !Number.isFinite(pointLat) ||
    !Number.isFinite(pointLng)
  ) {
    return null;
  }

  return (
    featureCollection.features.find((feature) =>
      pointInPolygonGeometry(pointLng, pointLat, feature?.geometry),
    ) || null
  );
};

export const getBoundsForGeoJsonFeature = (feature) => {
  if (!feature) {
    return null;
  }

  const layer = L.geoJSON(feature);
  const bounds = layer.getBounds();

  return bounds.isValid() ? bounds : null;
};



export const getLakeGeometry = (lake) => {
  const boundary = lake?.boundary;

  if (!boundary) {
    return null;
  }

  if (typeof boundary === "string") {
    try {
      return JSON.parse(boundary);
    } catch {
      return null;
    }
  }

  if (boundary?.type && Array.isArray(boundary?.coordinates)) {
    return boundary;
  }

  return null;
};

export const focusLakeOnMap = (map, lake, options = {}) => {
  if (!map || !lake) {
    return;
  }

  const {
    maxZoom = 16,
    markerZoom = 15,
    paddingTopLeft = [48, 48],
    paddingBottomRight = [48, 48],
    animate = true,
    duration = 1,
    centerOffset = null,
  } = options;

  const geometry = getLakeGeometry(lake);

  if (geometry) {
    try {
      const bounds = L.geoJSON(geometry).getBounds();

      if (bounds.isValid()) {
        map.flyToBounds(bounds, {
          paddingTopLeft,
          paddingBottomRight,
          maxZoom,
          animate,
          duration,
        });
        return;
      }
    } catch {
      // fall through to point focus
    }
  }

  const latitude = Number(lake.latitude ?? lake.display_lat ?? lake.lat);
  const longitude = Number(lake.longitude ?? lake.display_lng ?? lake.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return;
  }

  const target = L.latLng(latitude, longitude);
  let center = target;

  if (Array.isArray(centerOffset) && centerOffset.length === 2) {
    const offsetX = Number(centerOffset[0]) || 0;
    const offsetY = Number(centerOffset[1]) || 0;
    const projected = map.project(target, markerZoom);
    center = map.unproject(
      L.point(projected.x + offsetX, projected.y + offsetY),
      markerZoom,
    );
  }

  map.flyTo(center, markerZoom, {
    animate,
    duration,
  });
};

export const createLakeIcon = (isSelected = false) =>
  L.divIcon({
    className: "custom-lake-marker-wrapper",
    html: `
      <div class="custom-lake-marker ${isSelected ? "selected" : ""}">
        <div class="custom-lake-marker-dot"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

export const createUserLocationIcon = () =>
  L.divIcon({
    className: "user-location-marker-wrapper",
    html: `
      <div class="user-location-marker">
        <div class="user-location-pulse"></div>
        <div class="user-location-core"></div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

export const createClusterCustomIcon = (cluster) => {
  const count = cluster.getChildCount();

  return L.divIcon({
    html: `<div class="custom-cluster-marker"><span>${count}</span></div>`,
    className: "custom-cluster-marker-wrapper",
    iconSize: [42, 42],
  });
};

export const dedupeLakesByNearbyMarkerPosition = (
  lakes,
  thresholdMeters = 90,
) => {
  if (!Array.isArray(lakes) || lakes.length === 0) {
    return [];
  }

  const kept = [];

  for (const lake of lakes) {
    const latitude = Number(lake.latitude);
    const longitude = Number(lake.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }

    const isDuplicate = kept.some((existing) => {
      const distance = getDistanceKm(
        { lat: existing.latitude, lng: existing.longitude },
        { lat: latitude, lng: longitude },
      );

      return distance !== null && distance * 1000 <= thresholdMeters;
    });

    if (!isDuplicate) {
      kept.push({
        ...lake,
        latitude,
        longitude,
      });
    }
  }

  return kept;
};