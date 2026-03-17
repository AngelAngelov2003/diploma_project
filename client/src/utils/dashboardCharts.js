import { toDateOnlyKey } from "./date";

export const buildTopSpecies = (logs, limit = 10) => {
  const group = new Map();
  for (const c of logs) {
    const key = c.species || "Unknown";
    group.set(key, (group.get(key) || 0) + 1);
  }
  return Array.from(group.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
};

export const buildTopLakes = (logs, limit = 10) => {
  const group = new Map();
  for (const c of logs) {
    const key = c.lake_name || c.water_body_name || "Unknown";
    group.set(key, (group.get(key) || 0) + 1);
  }
  return Array.from(group.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
};

export const buildTrendByDay = (logs) => {
  const group = new Map();
  for (const c of logs) {
    const when = c.catch_time || c.created_at;
    const k = toDateOnlyKey(when);
    if (!k) continue;
    group.set(k, (group.get(k) || 0) + 1);
  }
  return Array.from(group.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const buildAvgWeightBySpecies = (logs, limit = 10) => {
  const sums = new Map();
  for (const c of logs) {
    const sp = c.species || "Unknown";
    const w = c.weight_kg != null ? Number(c.weight_kg) : NaN;
    if (!Number.isFinite(w)) continue;
    const cur = sums.get(sp) || { sum: 0, count: 0 };
    cur.sum += w;
    cur.count += 1;
    sums.set(sp, cur);
  }

  return Array.from(sums.entries())
    .map(([name, v]) => ({
      name,
      value: v.count ? Number((v.sum / v.count).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
};