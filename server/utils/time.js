const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Sofia";
const DAILY_ALERT_HOUR = Number(process.env.DAILY_ALERT_HOUR || 7);
const WEEKLY_ALERT_HOUR = Number(process.env.WEEKLY_ALERT_HOUR || 7);
const WEEKLY_ALERT_DAY = Number(process.env.WEEKLY_ALERT_DAY || 1);

const getTimePartsInTimeZone = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return map;
};

const toISODate = (date = new Date()) => {
  const p = getTimePartsInTimeZone(date);
  return `${p.year}-${p.month}-${p.day}`;
};

const getMinutesNowInTimeZone = (date = new Date()) => {
  const p = getTimePartsInTimeZone(date);
  return Number(p.hour) * 60 + Number(p.minute);
};

const getWeekdayInTimeZone = (date = new Date()) => {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).format(date);

  const map = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[weekday];
};

const getMostRecentScheduledWeeklyDate = (date = new Date()) => {
  const currentWeekday = getWeekdayInTimeZone(date);
  const daysSinceScheduled = (currentWeekday - WEEKLY_ALERT_DAY + 7) % 7;
  const targetDate = new Date(date.getTime() - daysSinceScheduled * 24 * 60 * 60 * 1000);

  return toISODate(targetDate);
};

module.exports = {
  APP_TIMEZONE,
  DAILY_ALERT_HOUR,
  WEEKLY_ALERT_HOUR,
  WEEKLY_ALERT_DAY,
  getTimePartsInTimeZone,
  toISODate,
  getMinutesNowInTimeZone,
  getWeekdayInTimeZone,
  getMostRecentScheduledWeeklyDate,
};