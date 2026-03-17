const parseNullableNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseNullableInteger = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

const parseNullableString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
};

const parseDateToISOString = (value) => {
  if (!value) {
    return null;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d.toISOString();
};

const isNonEmptyString = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

const isValidEmail = (value) => {
  if (!isNonEmptyString(value)) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim().toLowerCase());
};

const isValidRole = (value) => {
  return ["user", "owner", "admin"].includes(String(value || "").trim().toLowerCase());
};

const isValidNotificationFrequency = (value) => {
  return ["daily", "weekly"].includes(String(value || "").trim().toLowerCase());
};

const isValidReservationStatus = (value) => {
  return ["pending", "approved", "rejected", "cancelled"].includes(
    String(value || "").trim().toLowerCase()
  );
};

const isValidReviewRating = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5;
};

const isValidMinScore = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100;
};

const parseCatchPayload = (body = {}) => {
  const water_body_id = body.water_body_id ? String(body.water_body_id).trim() : null;
  const species = body.species ? String(body.species).trim() : null;
  const notes = body.notes ? String(body.notes).trim() : null;
  const moon_phase = body.moon_phase ? String(body.moon_phase).trim() : null;

  let parsedCatchTime = null;
  if (body.catch_time) {
    const d = new Date(body.catch_time);
    if (!Number.isNaN(d.getTime())) {
      parsedCatchTime = d.toISOString();
    }
  }

  return {
    water_body_id,
    species,
    weight_kg: parseNullableNumber(body.weight_kg),
    catch_time: parsedCatchTime,
    temperature: parseNullableNumber(body.temperature),
    pressure: parseNullableNumber(body.pressure),
    wind_speed: parseNullableNumber(body.wind_speed),
    humidity: parseNullableNumber(body.humidity),
    moon_phase,
    notes,
  };
};

module.exports = {
  parseNullableNumber,
  parseNullableInteger,
  parseNullableString,
  parseBoolean,
  parseDateToISOString,
  isNonEmptyString,
  isValidEmail,
  isValidRole,
  isValidNotificationFrequency,
  isValidReservationStatus,
  isValidReviewRating,
  isValidMinScore,
  parseCatchPayload,
};