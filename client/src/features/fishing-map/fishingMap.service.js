import {
  getWaterBodiesInBounds,
  searchWaterBodies,
  getWaterBodyById,
} from "../../api/waterBodiesApi";

const BOUNDS_CACHE_TTL_MS = 30 * 1000;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const WATER_BODY_CACHE_TTL_MS = 5 * 60 * 1000;
const SESSION_PREFIX = "fishing-map-cache";

const memoryCache = {
  bounds: new Map(),
  search: new Map(),
  waterBody: new Map(),
};

const isBrowser = typeof window !== "undefined";

const normalizeNumber = (value, precision = 4) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(precision) : "";
};

const getBoundsCacheKey = (params = {}) =>
  JSON.stringify({
    west: normalizeNumber(params.west),
    south: normalizeNumber(params.south),
    east: normalizeNumber(params.east),
    north: normalizeNumber(params.north),
    zoom: Math.round(Number(params.zoom) || 0),
    q: String(params.q || "").trim().toLowerCase(),
    sortBy: String(params.sortBy || "default"),
    userLat: normalizeNumber(params.userLat),
    userLng: normalizeNumber(params.userLng),
    distanceKm: params.distanceKm === undefined ? "" : String(params.distanceKm),
  });

const getSearchCacheKey = (query = "") => String(query || "").trim().toLowerCase();
const getWaterBodyCacheKey = (id) => String(id || "").trim();

const getSessionCacheKey = (namespace, key) => `${SESSION_PREFIX}:${namespace}:${key}`;

const readCache = (namespace, key, ttlMs) => {
  const memoryEntry = memoryCache[namespace].get(key);
  const now = Date.now();

  if (memoryEntry && now - memoryEntry.timestamp <= ttlMs) {
    return memoryEntry.value;
  }

  if (!isBrowser) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getSessionCacheKey(namespace, key));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || now - Number(parsed.timestamp || 0) > ttlMs) {
      window.sessionStorage.removeItem(getSessionCacheKey(namespace, key));
      return null;
    }

    memoryCache[namespace].set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
};

const writeCache = (namespace, key, value) => {
  const entry = {
    value,
    timestamp: Date.now(),
  };

  memoryCache[namespace].set(key, entry);

  if (!isBrowser) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getSessionCacheKey(namespace, key),
      JSON.stringify(entry),
    );
  } catch {
    // ignore storage quota errors
  }
};

export const fetchWaterBodiesInBounds = async (params) => {
  const key = getBoundsCacheKey(params);
  const cachedValue = readCache("bounds", key, BOUNDS_CACHE_TTL_MS);

  if (cachedValue) {
    return cachedValue;
  }

  const data = await getWaterBodiesInBounds(params);
  writeCache("bounds", key, data || []);
  return data;
};

export const fetchSearchResults = async (query) => {
  const normalizedQuery = String(query || "").trim();

  if (!normalizedQuery) {
    return [];
  }

  const key = getSearchCacheKey(normalizedQuery);
  const cachedValue = readCache("search", key, SEARCH_CACHE_TTL_MS);

  if (cachedValue) {
    return cachedValue;
  }

  const data = await searchWaterBodies(normalizedQuery);
  writeCache("search", key, data || []);
  return data;
};

export const fetchWaterBodyById = async (id) => {
  const key = getWaterBodyCacheKey(id);
  const cachedValue = readCache("waterBody", key, WATER_BODY_CACHE_TTL_MS);

  if (cachedValue) {
    return cachedValue;
  }

  const data = await getWaterBodyById(id);

  if (data) {
    writeCache("waterBody", key, data);
  }

  return data;
};
