const cron = require("node-cron");
const pool = require("../db");
const { sendEmail } = require("./emailService");
const { fetchForecastForLatLng, fetchWeeklyForecastForLatLng, isMlServerHealthy } = require("./forecastService");
const {
  APP_TIMEZONE,
  DAILY_ALERT_HOUR,
  WEEKLY_ALERT_HOUR,
  WEEKLY_ALERT_DAY,
  toISODate,
  getMinutesNowInTimeZone,
  getWeekdayInTimeZone,
  getMostRecentScheduledWeeklyDate,
} = require("../utils/time");

const DAILY_ALERT_JOB_NAME = "daily_alert_emails";
const WEEKLY_ALERT_JOB_NAME = "weekly_alert_emails";
const ALERT_RETRY_INTERVAL_MINUTES = Math.max(
  1,
  Number(process.env.ALERT_RETRY_INTERVAL_MINUTES || 10),
);
const ALERT_MAX_RETRY_ATTEMPTS = Math.max(
  1,
  Number(process.env.ALERT_MAX_RETRY_ATTEMPTS || 12),
);
const alertRetryState = new Map();

const getRetryJobKey = ({ frequency, deliveryDate }) => `${frequency}:${deliveryDate}`;

const clearRetryJob = (key) => {
  const existing = alertRetryState.get(key);
  if (!existing) return;

  if (existing.timeoutId) {
    clearTimeout(existing.timeoutId);
  }

  alertRetryState.delete(key);
};


const formatForecastDate = (date) => {
  if (!date) return "N/A";

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return String(date);

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
};

const getScoreLabel = (score) => {
  const n = Number(score || 0);

  if (n >= 80) return "Excellent";
  if (n >= 70) return "Very good";
  if (n >= 60) return "Good";
  if (n >= 50) return "Fair";
  return "Poor";
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const renderExplanationList = (explanation) => {
  const reasons = Array.isArray(explanation?.reasons) ? explanation.reasons : [];
  const warnings = Array.isArray(explanation?.warnings) ? explanation.warnings : [];
  const lines = [...reasons, ...warnings];
  if (!lines.length && !explanation?.summary) return "";

  return `
    <div style="margin-top:10px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;">
      ${explanation?.summary ? `<div style="font-weight:700;color:#0f172a;margin-bottom:6px;">${escapeHtml(explanation.summary)}</div>` : ""}
      ${lines.length ? `
        <ul style="margin:0;padding-left:18px;color:#475569;font-size:13px;line-height:1.6;">
          ${lines.slice(0, 4).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
      ` : ""}
    </div>
  `;
};

const renderCombinedAlertEmail = ({ userName, periodLabel, alerts }) => {
  const safeName = userName || "angler";
  const isWeeklyEmail = String(periodLabel).toLowerCase() === "weekly";

  const sortedAlerts = [...(alerts || [])].sort(
    (a, b) => Number(b.forecast?.total_score || 0) - Number(a.forecast?.total_score || 0)
  );

  const rows = sortedAlerts
    .map((item, index) => {
      const forecast = item.forecast || {};
      const weeklyForecast = item.weeklyForecast || [];
      const score = Number(forecast.total_score || 0);
      const scoreLabel = getScoreLabel(score);
      const forecastDateText = formatForecastDate(forecast.date);
      const weeklyRows = weeklyForecast
        .map((day) => `
          <tr>
            <td style="padding:7px 8px;border-top:1px solid #e5e7eb;white-space:nowrap;">${formatForecastDate(day.date)}</td>
            <td style="padding:7px 8px;border-top:1px solid #e5e7eb;font-weight:700;">${Number(day.total_score || 0)}%</td>
            <td style="padding:7px 8px;border-top:1px solid #e5e7eb;">${day.desc || "N/A"}</td>
            <td style="padding:7px 8px;border-top:1px solid #e5e7eb;white-space:nowrap;">${day.temp ?? "N/A"} °C</td>
            <td style="padding:7px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(day.explanation?.summary || "")}</td>
          </tr>
        `)
        .join("");

      return `
        <div style="border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;margin-bottom:12px;background:#fff;">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
            <div style="font-size:18px;font-weight:700;color:#111827;">${index + 1}. ${item.lake_name}</div>
            <div style="background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;">
              ${score}% · ${scoreLabel}
            </div>
          </div>
          <div style="margin-top:10px;font-size:14px;color:#374151;line-height:1.7;">
            <div><b>Forecast date:</b> ${forecastDateText}</div>
            <div><b>Weather:</b> ${forecast.desc || "N/A"}</div>
            <div><b>Temperature:</b> ${forecast.temp ?? "N/A"} °C</div>
            <div><b>Pressure:</b> ${forecast.pressure ?? "N/A"} hPa</div>
            <div><b>Wind:</b> ${forecast.wind ?? "N/A"} m/s</div>
            <div><b>Your minimum score:</b> ${Number(item.min_score || 0)}%</div>
          </div>
          ${renderExplanationList(forecast.explanation)}
          ${weeklyRows ? `
            <div style="margin-top:12px;overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
                <thead>
                  <tr>
                    <th style="text-align:left;padding:7px 8px;background:#f8fafc;">Date</th>
                    <th style="text-align:left;padding:7px 8px;background:#f8fafc;">Score</th>
                    <th style="text-align:left;padding:7px 8px;background:#f8fafc;">Weather</th>
                    <th style="text-align:left;padding:7px 8px;background:#f8fafc;">Temp</th>
                    <th style="text-align:left;padding:7px 8px;background:#f8fafc;">Reason</th>
                  </tr>
                </thead>
                <tbody>${weeklyRows}</tbody>
              </table>
            </div>
          ` : ""}
        </div>
      `;
    })
    .join("");

  const topAlert = sortedAlerts[0];

  const subjectLine =
    sortedAlerts.length === 1
      ? "1 lake matched your alert settings"
      : `${sortedAlerts.length} lakes matched your alert settings`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;line-height:1.5;color:#111827;background:#f8fafc;padding:20px;">
      <div style="background:white;border:1px solid #e5e7eb;border-radius:18px;padding:22px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#2563eb;margin-bottom:8px;">
          ${periodLabel} fishing alerts
        </div>

        <h2 style="margin:0 0 8px 0;color:#0f172a;">Hi ${safeName}, here are your best lake alerts</h2>

        <div style="color:#475569;font-size:14px;margin-bottom:16px;">
          ${subjectLine}. ${isWeeklyEmail ? "The table shows the forecast dates for the coming week." : "Each forecast is for tomorrow and now includes the exact forecast date."} Lakes are sorted from highest fishing score to lowest so the best conditions appear first.
        </div>

        ${
          topAlert
            ? `
          <div style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:white;border-radius:16px;padding:16px 18px;margin-bottom:16px;">
            <div style="font-size:12px;font-weight:700;opacity:0.9;text-transform:uppercase;letter-spacing:0.04em;">
              Top recommendation
            </div>
            <div style="font-size:24px;font-weight:800;margin-top:6px;">${topAlert.lake_name}</div>
            <div style="margin-top:8px;font-size:14px;opacity:0.95;">
              Fishing score: <b>${Number(topAlert.forecast?.total_score || 0)}%</b> · ${getScoreLabel(
                topAlert.forecast?.total_score
              )}
            </div>
          </div>
        `
            : ""
        }

        ${rows}

        <div style="margin-top:16px;color:#64748b;font-size:12px;">
          You’re receiving this email because you enabled lake alerts in your account.
        </div>
      </div>
    </div>
  `;
};

const hasSuccessfulJobRun = async (jobName, runDate) => {
  const q = await pool.query(
    `
      SELECT 1
      FROM alert_job_runs
      WHERE job_name = $1 AND run_date = $2 AND status = 'success'
      LIMIT 1
    `,
    [jobName, runDate]
  );

  return q.rows.length > 0;
};

const markSuccessfulJobRun = async (jobName, runDate) => {
  await pool.query(
    `
      INSERT INTO alert_job_runs (job_name, run_date, status)
      VALUES ($1, $2, 'success')
      ON CONFLICT (job_name, run_date)
      DO UPDATE SET status = 'success', created_at = NOW()
    `,
    [jobName, runDate]
  );
};

const processAlertEmails = async ({ frequency, deliveryDate, periodLabel }) => {
  const { rows: subs } = await pool.query(
    `
      SELECT
        s.id AS subscription_id,
        s.user_id,
        s.water_body_id,
        s.notification_frequency,
        s.min_score,
        u.email AS user_email,
        u.full_name AS user_name,
        w.name AS lake_name,
        COALESCE(ST_Y(ST_Centroid(w.geom)), w.display_lat) AS latitude,
        COALESCE(ST_X(ST_Centroid(w.geom)), w.display_lng) AS longitude,
        COALESCE(p.email_alerts_enabled, TRUE) AS email_alerts_enabled
      FROM lake_subscriptions s
      JOIN users u ON u.id = s.user_id
      JOIN water_bodies w ON w.id = s.water_body_id
      LEFT JOIN user_notification_preferences p ON p.user_id = s.user_id
      WHERE s.is_active = TRUE
        AND s.notification_frequency = $1
        AND COALESCE(p.email_alerts_enabled, TRUE) = TRUE
      ORDER BY u.email ASC, w.name ASC
    `,
    [frequency]
  );

  const grouped = new Map();

  for (const sub of subs) {
    if (!grouped.has(sub.user_id)) {
      grouped.set(sub.user_id, {
        user_id: sub.user_id,
        user_email: sub.user_email,
        user_name: sub.user_name,
        items: [],
      });
    }

    grouped.get(sub.user_id).items.push(sub);
  }

  for (const [, group] of grouped) {
    const qualifiedAlerts = [];

    for (const sub of group.items) {
      try {
        const already = await pool.query(
          `
            SELECT 1
            FROM subscription_deliveries
            WHERE subscription_id = $1 AND delivery_date = $2
          `,
          [sub.subscription_id, deliveryDate]
        );

        if (already.rows.length) continue;

        const lat = Number(sub.latitude);
        const lng = Number(sub.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error("Lake has no centroid coords");
        }

        const weeklyForecast = frequency === "weekly"
          ? await fetchWeeklyForecastForLatLng(lat, lng)
          : null;
        const forecast = weeklyForecast?.length
          ? weeklyForecast.reduce((best, day) => Number(day.total_score || 0) > Number(best.total_score || 0) ? day : best, weeklyForecast[0])
          : await fetchForecastForLatLng(lat, lng);

        if (Number(forecast.total_score || 0) < Number(sub.min_score || 0)) {
          await pool.query(
            `
              INSERT INTO subscription_deliveries (subscription_id, delivery_date, status, error)
              VALUES ($1, $2, 'skipped', $3)
              ON CONFLICT (subscription_id, delivery_date)
              DO UPDATE SET status = 'skipped', error = EXCLUDED.error, sent_at = NOW()
            `,
            [
              sub.subscription_id,
              deliveryDate,
              `Skipped because score ${forecast.total_score}% is below min score ${sub.min_score}%`,
            ]
          );
          continue;
        }

        qualifiedAlerts.push({
          subscription_id: sub.subscription_id,
          lake_name: sub.lake_name,
          min_score: Number(sub.min_score || 0),
          forecast,
          weeklyForecast,
        });
      } catch (err) {
        try {
          await pool.query(
            `
              INSERT INTO subscription_deliveries (subscription_id, delivery_date, status, error)
              VALUES ($1, $2, 'error', $3)
              ON CONFLICT (subscription_id, delivery_date)
              DO UPDATE SET status = 'error', error = EXCLUDED.error, sent_at = NOW()
            `,
            [sub.subscription_id, deliveryDate, String(err?.message || err)]
          );
        } catch (dbErr) {
          console.error("[alerts] Failed to record subscription error:", dbErr);
        }

        console.error("[alerts] Failed to prepare alert:", err);
      }
    }

    if (!qualifiedAlerts.length) continue;

    qualifiedAlerts.sort(
      (a, b) => Number(b.forecast?.total_score || 0) - Number(a.forecast?.total_score || 0)
    );

    try {
      const html = renderCombinedAlertEmail({
        userName: group.user_name,
        periodLabel,
        alerts: qualifiedAlerts,
      });

      const subjectDatePart = frequency === "daily" ? ` for ${deliveryDate}` : "";
      const subject =
        qualifiedAlerts.length === 1
          ? `${periodLabel} fishing alerts${subjectDatePart} — 1 lake matched`
          : `${periodLabel} fishing alerts${subjectDatePart} — ${qualifiedAlerts.length} lakes matched`;

      console.log(
        `[alerts] Sending ${periodLabel} alert email to ${group.user_email} with ${qualifiedAlerts.length} lake(s)`
      );

      await sendEmail({
        to: group.user_email,
        subject,
        html,
      });

      console.log(`[alerts] Email sent successfully to ${group.user_email}`);

      for (const item of qualifiedAlerts) {
        await pool.query(
          `
            INSERT INTO subscription_deliveries (subscription_id, delivery_date, status)
            VALUES ($1, $2, 'sent')
            ON CONFLICT (subscription_id, delivery_date)
            DO UPDATE SET status = 'sent', error = NULL, sent_at = NOW()
          `,
          [item.subscription_id, deliveryDate]
        );
      }
    } catch (err) {
      console.error(`[alerts] Email send failed for ${group.user_email}:`, err);

      for (const item of qualifiedAlerts) {
        try {
          await pool.query(
            `
              INSERT INTO subscription_deliveries (subscription_id, delivery_date, status, error)
              VALUES ($1, $2, 'error', $3)
              ON CONFLICT (subscription_id, delivery_date)
              DO UPDATE SET status = 'error', error = EXCLUDED.error, sent_at = NOW()
            `,
            [item.subscription_id, deliveryDate, String(err?.message || err)]
          );
        } catch (dbErr) {
          console.error("[alerts] Failed to record send error:", dbErr);
        }
      }

      throw err;
    }
  }
};

const scheduleAlertRetry = ({ frequency, deliveryDate, attempt }) => {
  const key = getRetryJobKey({ frequency, deliveryDate });
  const existing = alertRetryState.get(key);

  if (existing?.timeoutId) {
    clearTimeout(existing.timeoutId);
  }

  const timeoutMs = ALERT_RETRY_INTERVAL_MINUTES * 60 * 1000;
  const timeoutId = setTimeout(() => {
    runAlertEmails({
      frequency,
      force: false,
      deliveryDate,
      retryAttempt: attempt,
      triggeredByRetry: true,
    }).catch((err) => {
      console.error(
        `[alerts] Retry run failed for ${frequency} alerts (${deliveryDate}):`,
        err,
      );
    });
  }, timeoutMs);

  alertRetryState.set(key, {
    frequency,
    deliveryDate,
    attempt,
    timeoutId,
    scheduledAt: Date.now(),
  });
};

const runAlertEmails = async ({
  frequency,
  force = false,
  deliveryDate,
  retryAttempt = 0,
  triggeredByRetry = false,
}) => {
  const finalDeliveryDate = deliveryDate || toISODate();
  const isWeekly = frequency === "weekly";
  const jobName = isWeekly ? WEEKLY_ALERT_JOB_NAME : DAILY_ALERT_JOB_NAME;
  const periodLabel = isWeekly ? "Weekly" : "Daily";
  const retryKey = getRetryJobKey({
    frequency,
    deliveryDate: finalDeliveryDate,
  });

  if (!force) {
    const alreadyRan = await hasSuccessfulJobRun(jobName, finalDeliveryDate);
    if (alreadyRan) {
      clearRetryJob(retryKey);

      return {
        ok: true,
        skipped: true,
        reason: "already_ran",
        frequency,
        deliveryDate: finalDeliveryDate,
      };
    }
  }

  const mlHealthy = await isMlServerHealthy();
  if (!mlHealthy) {
    if (retryAttempt >= ALERT_MAX_RETRY_ATTEMPTS) {
      clearRetryJob(retryKey);
      console.error(
        `[alerts] ${periodLabel} alerts skipped for ${finalDeliveryDate}: ML server unavailable after ${retryAttempt} retry attempt(s).`,
      );

      return {
        ok: false,
        skipped: true,
        reason: "ml_unavailable_max_retries_reached",
        frequency,
        deliveryDate: finalDeliveryDate,
        retryAttempt,
      };
    }

    const nextAttempt = retryAttempt + 1;
    console.warn(
      `[alerts] ${periodLabel} alerts delayed for ${finalDeliveryDate}: ML server unavailable. Retrying in ${ALERT_RETRY_INTERVAL_MINUTES} minute(s) (attempt ${nextAttempt}/${ALERT_MAX_RETRY_ATTEMPTS}).`,
    );

    scheduleAlertRetry({
      frequency,
      deliveryDate: finalDeliveryDate,
      attempt: nextAttempt,
    });

    return {
      ok: false,
      skipped: true,
      reason: "ml_unavailable_retry_scheduled",
      frequency,
      deliveryDate: finalDeliveryDate,
      retryAttempt: nextAttempt,
    };
  }

  if (triggeredByRetry && retryAttempt > 0) {
    console.log(
      `[alerts] ${periodLabel} alerts recovered for ${finalDeliveryDate}: ML server is healthy again. Sending now after ${retryAttempt} retry attempt(s).`,
    );
  }

  clearRetryJob(retryKey);

  await processAlertEmails({
    frequency,
    deliveryDate: finalDeliveryDate,
    periodLabel,
  });

  clearRetryJob(retryKey);
  await markSuccessfulJobRun(jobName, finalDeliveryDate);

  return {
    ok: true,
    skipped: false,
    frequency,
    deliveryDate: finalDeliveryDate,
  };
};

const runDailyAlertEmails = async ({ force = false, deliveryDate } = {}) => {
  return runAlertEmails({
    frequency: "daily",
    force,
    deliveryDate,
  });
};

const runWeeklyAlertEmails = async ({ force = false, deliveryDate } = {}) => {
  const finalDeliveryDate = deliveryDate || getMostRecentScheduledWeeklyDate();

  return runAlertEmails({
    frequency: "weekly",
    force,
    deliveryDate: finalDeliveryDate,
  });
};

const runStartupCatchUp = async () => {
  const now = new Date();
  const nowMinutes = getMinutesNowInTimeZone(now);
  const currentWeekday = getWeekdayInTimeZone(now);

  const dailyScheduledMinutes = DAILY_ALERT_HOUR * 60;
  if (nowMinutes >= dailyScheduledMinutes) {
    await runDailyAlertEmails();
  }

  const weeklyScheduledMinutes = WEEKLY_ALERT_HOUR * 60;
  const shouldRunWeekly =
    currentWeekday > WEEKLY_ALERT_DAY ||
    (currentWeekday === WEEKLY_ALERT_DAY && nowMinutes >= weeklyScheduledMinutes);

  if (shouldRunWeekly) {
    await runWeeklyAlertEmails({
      deliveryDate: getMostRecentScheduledWeeklyDate(now),
    });
  }
};

const startDailyCron = () => {
  cron.schedule(
    `0 ${DAILY_ALERT_HOUR} * * *`,
    () => {
      runDailyAlertEmails().catch((err) => {
        console.error("Daily alert job failed:", err);
      });
    },
    { timezone: APP_TIMEZONE }
  );
};

const startWeeklyCron = () => {
  cron.schedule(
    `0 ${WEEKLY_ALERT_HOUR} * * ${WEEKLY_ALERT_DAY}`,
    () => {
      runWeeklyAlertEmails({
        deliveryDate: getMostRecentScheduledWeeklyDate(),
      }).catch((err) => {
        console.error("Weekly alert job failed:", err);
      });
    },
    { timezone: APP_TIMEZONE }
  );
};

module.exports = {
  DAILY_ALERT_JOB_NAME,
  WEEKLY_ALERT_JOB_NAME,
  getScoreLabel,
  renderCombinedAlertEmail,
  hasSuccessfulJobRun,
  markSuccessfulJobRun,
  processAlertEmails,
  runAlertEmails,
  runDailyAlertEmails,
  runWeeklyAlertEmails,
  runStartupCatchUp,
  startDailyCron,
  startWeeklyCron,
};
