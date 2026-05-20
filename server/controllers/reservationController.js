const pool = require("../db");
const { ensureReservationDomainTables } = require("../setup/ensureTables");
const { sendEmail, getSmtpSummary } = require("../services/emailService");
const billingService = require("../services/billingService");
const { requireStripe, getAppUrl } = require("../services/stripeService");

const ACTIVE_RESERVATION_STATUSES = ["pending", "approved", "approved_waiting_payment"];
const MANAGEABLE_STATUSES = ["approved", "approved_waiting_payment", "rejected", "pending"];

let schemaEnsured = false;
const ensureSchema = async () => {
  if (!schemaEnsured) {
    await ensureReservationDomainTables();
    schemaEnsured = true;
  }
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getPlatformFeePercent = () => {
  const value = Number(process.env.PLATFORM_FEE_PERCENT || 10);
  return Number.isFinite(value) && value >= 0 ? value : 10;
};

const buildPaymentBreakdown = (totalAmount) => {
  const total = toNumber(totalAmount, 0);
  const platformFeeAmount = Number(((total * getPlatformFeePercent()) / 100).toFixed(2));
  const ownerAmount = Number((total - platformFeeAmount).toFixed(2));
  return { platformFeeAmount, ownerAmount };
};

const getReservationCurrency = () => String(process.env.STRIPE_RESERVATION_CURRENCY || "eur").toLowerCase();

const toStripeAmount = (value) => Math.max(0, Math.round(toNumber(value, 0) * 100));

const canUseOnlinePayments = async (ownerId) => {
  if (!ownerId) return { enabled: false, reason: "Lake owner is missing" };
  const ownerState = await billingService.getOwnerBillingState(ownerId, "owner");
  if (!ownerState.has_owner_pro_access) {
    return { enabled: false, reason: "Owner Pro subscription is required" };
  }
  if (!ownerState.connect_ready || !ownerState.stripe_connected_account_id) {
    return { enabled: false, reason: "Owner Stripe payout setup is not complete" };
  }
  return { enabled: true, ownerState };
};


const normalizeDate = (value) => String(value || "").trim();

const eachDateInclusive = (start, end) => {
  const dates = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const final = new Date(`${end}T00:00:00Z`);
  while (cursor <= final) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const normalizeTripDates = (body) => {
  const arrival = normalizeDate(body.arrival_date || body.start_date || body.reservation_date);
  const departure = normalizeDate(body.departure_date || body.end_date || body.start_date || body.reservation_date);
  return { arrival, departure };
};

const normalizeDateList = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => normalizeDate(item)).filter(Boolean))].sort();
};

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const isReservationPast = (reservation) => {
  const departure = normalizeDate(reservation?.departure_date || reservation?.end_date || reservation?.start_date || reservation?.reservation_date);
  return Boolean(departure && departure < getTodayDateString());
};

const canUserCancelReservation = (reservation) => {
  return ["pending", "approved", "approved_waiting_payment"].includes(String(reservation?.status || "")) && !isReservationPast(reservation);
};


const formatEmailDate = (value) => {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
};

const formatEmailCurrency = (value) => {
  const amount = Number(value || 0);
  return `€${amount.toFixed(2)}`;
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const safeJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }
  return [];
};

const getReservationNotificationContext = async (reservationId) => {
  // Keep the main lookup intentionally small and dependent only on core tables.
  // Earlier versions joined optional owner-claim tables in this query; if that
  // table was missing in a local database, the whole email flow silently skipped.
  const q = await pool.query(`
    SELECT
      r.id,
      r.status,
      r.notes,
      COALESCE(r.start_date, r.reservation_date) AS arrival_date,
      COALESCE(r.end_date, r.start_date, r.reservation_date) AS departure_date,
      COALESCE(r.requested_spots, r.people_count, 1) AS requested_spots,
      r.base_amount,
      r.night_fishing_amount,
      r.rooms_amount,
      r.total_amount,
      w.id AS water_body_id,
      w.name AS lake_name,
      w.owner_id,
      requester.id AS requester_id,
      requester.email AS user_email,
      requester.full_name AS user_name,
      owner.email AS owner_email,
      owner.full_name AS owner_name
    FROM lake_reservations r
    JOIN water_bodies w ON w.id = r.water_body_id
    JOIN users requester ON requester.id = r.user_id
    LEFT JOIN users owner ON owner.id = w.owner_id
    WHERE r.id = $1
    LIMIT 1
  `, [reservationId]);

  const reservation = q.rows[0] || null;
  if (!reservation) return null;

  // Fallback: some lakes may have an approved owner claim email even when
  // water_bodies.owner_id is not populated. This lookup is optional and safe.
  if (!reservation.owner_email) {
    try {
      const claimQ = await pool.query(`
        SELECT email, full_name, user_id
        FROM lake_owner_claim_requests
        WHERE water_body_id = $1 AND status = 'approved'
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `, [reservation.water_body_id]);
      if (claimQ.rows[0]) {
        reservation.owner_email = claimQ.rows[0].email || reservation.owner_email;
        reservation.owner_name = claimQ.rows[0].full_name || reservation.owner_name;
        reservation.owner_claim_user_id = claimQ.rows[0].user_id || null;
      }
    } catch (error) {
      console.warn(`[reservation-email] Owner claim fallback skipped for reservation ${reservationId}:`, error.message);
    }
  }

  const listQueries = [
    pool.query(`
      SELECT fishing_date::text AS value
      FROM reservation_fishing_days
      WHERE reservation_id = $1
      ORDER BY fishing_date
    `, [reservationId]).then((result) => {
      reservation.fishing_dates = result.rows.map((row) => row.value);
    }),
    pool.query(`
      SELECT night_date::text AS value
      FROM reservation_night_fishing
      WHERE reservation_id = $1
      ORDER BY night_date
    `, [reservationId]).then((result) => {
      reservation.night_fishing_dates = result.rows.map((row) => row.value);
    }),
    pool.query(`
      SELECT ls.spot_number AS value
      FROM reservation_spots rs
      JOIN lake_spots ls ON ls.id = rs.spot_id
      WHERE rs.reservation_id = $1
      ORDER BY ls.spot_number
    `, [reservationId]).then((result) => {
      reservation.spot_numbers = result.rows.map((row) => row.value);
    }),
    pool.query(`
      SELECT rm.name AS value
      FROM lake_reservation_rooms rrm
      JOIN lake_rooms rm ON rm.id = rrm.room_id
      WHERE rrm.reservation_id = $1
      ORDER BY rm.name
    `, [reservationId]).then((result) => {
      reservation.room_names = result.rows.map((row) => row.value);
    }),
  ];

  await Promise.all(listQueries.map((query) => query.catch((error) => {
    console.warn(`[reservation-email] Optional reservation detail lookup failed for reservation ${reservationId}:`, error.message);
  })));

  reservation.fishing_dates = safeJsonArray(reservation.fishing_dates);
  reservation.night_fishing_dates = safeJsonArray(reservation.night_fishing_dates);
  reservation.spot_numbers = safeJsonArray(reservation.spot_numbers);
  reservation.room_names = safeJsonArray(reservation.room_names);

  return reservation;
};

const buildReservationEmailHtml = ({ title, intro, reservation }) => {
  const spotNumbers = Array.isArray(reservation.spot_numbers) ? reservation.spot_numbers : [];
  const fishingDates = Array.isArray(reservation.fishing_dates) ? reservation.fishing_dates : [];
  const nightDates = Array.isArray(reservation.night_fishing_dates) ? reservation.night_fishing_dates : [];
  const roomNames = Array.isArray(reservation.room_names) ? reservation.room_names : [];
  const notes = reservation.notes ? escapeHtml(reservation.notes) : "No notes";

  const rows = [
    ["Lake", reservation.lake_name],
    ["Stay", `${formatEmailDate(reservation.arrival_date)} → ${formatEmailDate(reservation.departure_date)}`],
    ["Selected spots", spotNumbers.length ? spotNumbers.map((number) => `Spot ${number}`).join(", ") : `${reservation.requested_spots || 1} spot(s)`],
    ["Fishing days", fishingDates.length ? fishingDates.map(formatEmailDate).join(", ") : "None"],
    ["Night fishing", nightDates.length ? nightDates.map(formatEmailDate).join(", ") : "None"],
    ["Rooms", roomNames.length ? roomNames.join(", ") : "None"],
    ["Total", formatEmailCurrency(reservation.total_amount)],
    ["Notes", notes],
  ];

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin: 0 0 10px;">${escapeHtml(title)}</h2>
      <p style="margin: 0 0 16px; color: #475569;">${escapeHtml(intro)}</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
        <tbody>
          ${rows.map(([label, value]) => `
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: 700; background: #f8fafc; width: 170px;">${escapeHtml(label)}</td>
              <td style="border: 1px solid #e2e8f0; padding: 10px;">${label === "Notes" ? value : escapeHtml(value)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
};

const buildReservationEmailText = ({ title, intro, reservation }) => {
  const spotNumbers = Array.isArray(reservation.spot_numbers) ? reservation.spot_numbers : [];
  const fishingDates = Array.isArray(reservation.fishing_dates) ? reservation.fishing_dates : [];
  const nightDates = Array.isArray(reservation.night_fishing_dates) ? reservation.night_fishing_dates : [];
  const roomNames = Array.isArray(reservation.room_names) ? reservation.room_names : [];

  return [
    title,
    "",
    intro,
    "",
    `Lake: ${reservation.lake_name || "-"}`,
    `Stay: ${formatEmailDate(reservation.arrival_date)} → ${formatEmailDate(reservation.departure_date)}`,
    `Selected spots: ${spotNumbers.length ? spotNumbers.map((number) => `Spot ${number}`).join(", ") : `${reservation.requested_spots || 1} spot(s)`}`,
    `Fishing days: ${fishingDates.length ? fishingDates.map(formatEmailDate).join(", ") : "None"}`,
    `Night fishing: ${nightDates.length ? nightDates.map(formatEmailDate).join(", ") : "None"}`,
    `Rooms: ${roomNames.length ? roomNames.join(", ") : "None"}`,
    `Total: ${formatEmailCurrency(reservation.total_amount)}`,
    `Notes: ${reservation.notes || "No notes"}`,
  ].join("\n");
};

const safeSendReservationEmail = async ({ to, subject, title, intro, reservation, reason }) => {
  const recipient = String(to || "").trim();

  if (!recipient) {
    console.warn(`[reservation-email] Skipped ${reason || "reservation email"}: missing recipient email for reservation ${reservation?.id || "unknown"}`);
    return false;
  }

  try {
    console.log(`[reservation-email] SMTP config`, getSmtpSummary());
    console.log(`[reservation-email] Sending ${reason || "reservation email"} to ${recipient} for reservation ${reservation?.id || "unknown"}`);

    const info = await sendEmail({
      to: recipient,
      subject,
      text: buildReservationEmailText({ title, intro, reservation }),
      html: buildReservationEmailHtml({ title, intro, reservation }),
    });

    console.log(`[reservation-email] Sent ${reason || "reservation email"} to ${recipient}`, { messageId: info?.messageId || null, response: info?.response || null });
    return true;
  } catch (error) {
    console.warn(`[reservation-email] Failed to send ${reason || "reservation email"} to ${recipient}:`, error.message);
    return false;
  }
};

const withReservationEmailContext = async (reservationId, handler) => {
  try {
    const reservation = await getReservationNotificationContext(reservationId);

    if (!reservation) {
      console.warn(`[reservation-email] Skipped email: reservation ${reservationId} was not found`);
      return;
    }

    console.log(`[reservation-email] Context for reservation ${reservationId}`, {
      lake: reservation.lake_name,
      ownerId: reservation.owner_id || null,
      ownerClaimUserId: reservation.owner_claim_user_id || null,
      ownerEmail: reservation.owner_email || null,
      userEmail: reservation.user_email || null,
      status: reservation.status || null,
    });

    await handler(reservation);
  } catch (error) {
    console.warn(`[reservation-email] Failed to prepare email for reservation ${reservationId}:`, error.message);
  }
};

const notifyReservationCreated = async (reservationId) => withReservationEmailContext(reservationId, async (reservation) => {
  await safeSendReservationEmail({
    to: reservation.owner_email,
    subject: `New reservation request for ${reservation.lake_name}`,
    title: "New reservation request",
    intro: `${reservation.user_name || "A user"} submitted a reservation request for your lake.`,
    reservation,
    reason: "new request owner notification",
  });

  await safeSendReservationEmail({
    to: reservation.user_email,
    subject: `Reservation request sent for ${reservation.lake_name}`,
    title: "Reservation request sent",
    intro: `Your reservation request for ${reservation.lake_name} was sent to the lake owner. You will be notified when it is approved or rejected.`,
    reservation,
    reason: "new request user confirmation",
  });
});

const notifyUserReservationStatusChanged = async (reservationId, status) => withReservationEmailContext(reservationId, async (reservation) => {
  const readableStatus = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "updated";

  await safeSendReservationEmail({
    to: reservation.user_email,
    subject: `Your reservation was ${readableStatus}`,
    title: `Reservation ${readableStatus}`,
    intro: `Your reservation request for ${reservation.lake_name} was ${readableStatus}.`,
    reservation,
    reason: `user ${readableStatus} notification`,
  });
});

const notifyOwnerReservationCancelled = async (reservationId) => withReservationEmailContext(reservationId, async (reservation) => {
  await safeSendReservationEmail({
    to: reservation.owner_email,
    subject: `Reservation cancelled for ${reservation.lake_name}`,
    title: "Reservation cancelled",
    intro: `${reservation.user_name || "A user"} cancelled their reservation request.`,
    reservation,
    reason: "owner cancellation notification",
  });
});

const queueReservationEmail = (task, label = "reservation email") => {
  setImmediate(async () => {
    try {
      await task();
    } catch (error) {
      console.warn(`[reservation-email] Background ${label} failed:`, error.message);
    }
  });
};

const getAllowedFishingDates = (arrival, departure) => {
  if (!arrival || !departure) return [];
  return eachDateInclusive(arrival, departure);
};

const getAllowedNightDates = (arrival, departure) => {
  if (!arrival || !departure) return [];
  const arrivalDate = new Date(`${arrival}T00:00:00Z`);
  const departureDate = new Date(`${departure}T00:00:00Z`);
  if (departureDate <= arrivalDate) return [];
  const dayBeforeDeparture = new Date(departureDate);
  dayBeforeDeparture.setUTCDate(dayBeforeDeparture.getUTCDate() - 1);
  return eachDateInclusive(arrival, dayBeforeDeparture.toISOString().slice(0, 10));
};

const getStayNightCount = (arrival, departure) => {
  const arrivalDate = new Date(`${arrival}T00:00:00Z`);
  const departureDate = new Date(`${departure}T00:00:00Z`);
  const diff = Math.floor((departureDate - arrivalDate) / 86400000);
  return Math.max(0, diff);
};

const getReservationById = async (reservationId) => {
  const q = await pool.query(`
    SELECT
      r.id,
      r.water_body_id,
      r.user_id,
      COALESCE(r.start_date, r.reservation_date) AS arrival_date,
      COALESCE(r.end_date, r.start_date, r.reservation_date) AS departure_date,
      r.reservation_date,
      r.notes,
      COALESCE(r.requested_spots, r.people_count, 1) AS requested_spots,
      r.people_count,
      r.includes_night_fishing,
      r.wants_housing,
      r.base_amount,
      r.night_fishing_amount,
      r.rooms_amount,
      r.total_amount,
      r.payment_status,
      r.payment_method,
      r.payment_required,
      r.platform_fee_amount,
      r.owner_amount,
      r.snapshot_price_per_day,
      r.snapshot_night_fishing_price,
      r.stripe_checkout_session_id,
      r.stripe_payment_intent_id,
      r.paid_at,
      r.status,
      r.created_at,
      r.updated_at,
      w.name AS lake_name,
      w.is_private,
      COALESCE((
        SELECT json_agg(rfd.fishing_date::text ORDER BY rfd.fishing_date)
        FROM reservation_fishing_days rfd
        WHERE rfd.reservation_id = r.id
      ), '[]'::json) AS fishing_dates,
      COALESCE((
        SELECT json_agg(rnf.night_date::text ORDER BY rnf.night_date)
        FROM reservation_night_fishing rnf
        WHERE rnf.reservation_id = r.id
      ), '[]'::json) AS night_fishing_dates,
      COALESCE((
        SELECT json_agg(json_build_object('id', rm.id, 'name', rm.name) ORDER BY rm.name)
        FROM lake_reservation_rooms rrm
        JOIN lake_rooms rm ON rm.id = rrm.room_id
        WHERE rrm.reservation_id = r.id
      ), '[]'::json) AS rooms,
      COALESCE((
        SELECT json_agg(json_build_object('id', ls.id, 'spot_number', ls.spot_number) ORDER BY ls.spot_number)
        FROM reservation_spots rs
        JOIN lake_spots ls ON ls.id = rs.spot_id
        WHERE rs.reservation_id = r.id
      ), '[]'::json) AS spots,
      COALESCE((
        SELECT json_agg(rm.name ORDER BY rm.name)
        FROM lake_reservation_rooms rrm
        JOIN lake_rooms rm ON rm.id = rrm.room_id
        WHERE rrm.reservation_id = r.id
      ), '[]'::json) AS room_names
    FROM lake_reservations r
    JOIN water_bodies w ON w.id = r.water_body_id
    WHERE r.id = $1
    LIMIT 1
  `, [reservationId]);
  return q.rows[0] || null;
};

const getBlockedDateStrings = async (waterBodyId, start, end) => {
  const q = await pool.query(`
    SELECT blocked_date::text AS blocked_date
    FROM lake_blocked_dates
    WHERE water_body_id = $1
      AND blocked_date BETWEEN $2 AND $3
  `, [waterBodyId, start, end]);
  return q.rows.map((row) => row.blocked_date);
};

const getLakeBookingContext = async (waterBodyId) => {
  const q = await pool.query(`
    SELECT
      id,
      name,
      is_private,
      owner_id,
      is_reservable,
      price_per_day,
      capacity,
      allows_night_fishing,
      night_fishing_price,
      has_housing,
      spots_count
    FROM water_bodies
    WHERE id = $1
    LIMIT 1
  `, [waterBodyId]);
  return q.rows[0] || null;
};

const getRooms = async (roomIds, waterBodyId) => {
  if (!roomIds.length) return [];
  const q = await pool.query(`
    SELECT id, water_body_id, name, capacity, price_per_night, is_active
    FROM lake_rooms
    WHERE water_body_id = $1 AND id = ANY($2::uuid[])
    ORDER BY sort_order ASC, name ASC
  `, [waterBodyId, roomIds]);
  return q.rows;
};

const getSelectedSpots = async (spotIds, waterBodyId) => {
  if (!spotIds.length) return [];
  const q = await pool.query(`
    SELECT id, water_body_id, spot_number, is_active
    FROM lake_spots
    WHERE water_body_id = $1 AND id = ANY($2::uuid[])
    ORDER BY spot_number ASC
  `, [waterBodyId, spotIds]);
  return q.rows;
};

const getReservedSpotIds = async ({ waterBodyId, arrival, departure, excludedReservationId = null }) => {
  const params = [waterBodyId, arrival, departure, ACTIVE_RESERVATION_STATUSES];
  let exclusionSql = "";
  if (excludedReservationId) {
    params.push(excludedReservationId);
    exclusionSql = ` AND r.id <> $${params.length}`;
  }

  const q = await pool.query(`
    SELECT DISTINCT rs.spot_id::text AS spot_id
    FROM reservation_spots rs
    JOIN lake_reservations r ON r.id = rs.reservation_id
    WHERE r.water_body_id = $1
      AND daterange(r.start_date::date, (r.end_date::date + 1)::date, '[)') && daterange($2::date, ($3::date + 1)::date, '[)')
      AND r.status = ANY($4::text[])
      ${exclusionSql}
  `, params);

  return q.rows.map((row) => row.spot_id);
};

const ensureSelectedSpotAvailability = async ({ spotIds, waterBodyId, arrival, departure, excludedReservationId = null }) => {
  if (!spotIds.length) return;

  const selectedSpots = await getSelectedSpots(spotIds, waterBodyId);
  if (selectedSpots.length !== spotIds.length) {
    throw new Error("One or more selected spots are invalid");
  }

  const inactive = selectedSpots.filter((spot) => !spot.is_active);
  if (inactive.length) {
    throw new Error(`These spots are inactive: ${inactive.map((spot) => spot.spot_number).join(', ')}`);
  }

  const reservedSpotIds = new Set(await getReservedSpotIds({ waterBodyId, arrival, departure, excludedReservationId }));
  const taken = selectedSpots.filter((spot) => reservedSpotIds.has(String(spot.id)));
  if (taken.length) {
    throw new Error(`These spots are already reserved for the selected dates: ${taken.map((spot) => spot.spot_number).join(', ')}`);
  }
};

const getReservedSpotCount = async ({ waterBodyId, arrival, departure, excludedReservationId = null }) => {
  const params = [waterBodyId, arrival, departure, ACTIVE_RESERVATION_STATUSES];
  let exclusionSql = "";
  if (excludedReservationId) {
    params.push(excludedReservationId);
    exclusionSql = ` AND r.id <> $${params.length}`;
  }
  const q = await pool.query(`
    SELECT COALESCE(SUM(r.requested_spots), 0)::int AS reserved_spots
    FROM lake_reservations r
    WHERE r.water_body_id = $1
      AND daterange(r.start_date::date, (r.end_date::date + 1)::date, '[)') && daterange($2::date, ($3::date + 1)::date, '[)')
      AND r.status = ANY($4::text[])
      ${exclusionSql}
  `, params);
  return Number(q.rows[0]?.reserved_spots || 0);
};

const ensureRoomAvailability = async ({ roomIds, arrival, departure, excludedReservationId = null }) => {
  if (!roomIds.length) return;
  const params = [roomIds, arrival, departure, ACTIVE_RESERVATION_STATUSES];
  let exclusionSql = "";
  if (excludedReservationId) {
    params.push(excludedReservationId);
    exclusionSql = ` AND r.id <> $${params.length}`;
  }
  const q = await pool.query(`
    SELECT DISTINCT rm.name
    FROM lake_reservation_rooms rrm
    JOIN lake_reservations r ON r.id = rrm.reservation_id
    JOIN lake_rooms rm ON rm.id = rrm.room_id
    WHERE rrm.room_id = ANY($1::uuid[])
      AND daterange(r.start_date::date, (r.end_date::date + 1)::date, '[)') && daterange($2::date, ($3::date + 1)::date, '[)')
      AND r.status = ANY($4::text[])
      ${exclusionSql}
  `, params);
  if (q.rows.length) {
    throw new Error(`Rooms already reserved for these dates: ${q.rows.map((row) => row.name).join(', ')}`);
  }
};

const buildPricing = ({ lake, requestedSpots, fishingDates, nightFishingDates, selectedRooms, stayNightCount }) => {
  const fishingUnits = fishingDates.length;
  const nightUnits = nightFishingDates.length;
  const baseAmount = toNumber(lake.price_per_day, 0) * requestedSpots * fishingUnits;
  const nightFishingAmount = toNumber(lake.night_fishing_price, 0) * requestedSpots * nightUnits;
  const roomsAmount = selectedRooms.reduce((sum, room) => sum + (toNumber(room.price_per_night, 0) * stayNightCount), 0);
  const totalAmount = baseAmount + nightFishingAmount + roomsAmount;
  return {
    baseAmount: Number(baseAmount.toFixed(2)),
    nightFishingAmount: Number(nightFishingAmount.toFixed(2)),
    roomsAmount: Number(roomsAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
    fishingUnits,
    nightUnits,
    stayNightCount,
  };
};

const validateReservationInput = ({ lake, arrival, departure, requestedSpots, roomIds, fishingDates, nightFishingDates, selectedSpotIds = [] }) => {
  if (!arrival || !departure) {
    throw new Error("arrival_date and departure_date are required");
  }
  if (new Date(`${departure}T00:00:00Z`) < new Date(`${arrival}T00:00:00Z`)) {
    throw new Error("departure_date must be after or equal to arrival_date");
  }
  if (!Number.isInteger(requestedSpots) || requestedSpots < 1) {
    throw new Error("requested_spots must be an integer greater than 0");
  }
  if (selectedSpotIds.length && selectedSpotIds.length !== requestedSpots) {
    throw new Error("Selected spot count must match requested spots");
  }
  if (!lake.is_private) throw new Error("Reservations are only allowed for private lakes");
  if (!lake.is_reservable) throw new Error("Reservations are currently disabled for this lake");
  const lakeCapacity = Math.max(1, toNumber(lake.spots_count, toNumber(lake.capacity, 1)));
  if (requestedSpots > lakeCapacity) {
    throw new Error(`This lake accepts up to ${lakeCapacity} spots per request`);
  }
  if (roomIds.length && !lake.has_housing) {
    throw new Error("This lake does not currently offer housing");
  }
  if (nightFishingDates.length && !lake.allows_night_fishing) {
    throw new Error("Night fishing is not enabled for this lake");
  }
  if (!fishingDates.length && !nightFishingDates.length && !roomIds.length) {
    throw new Error("Select at least one fishing day, night fishing night, or room");
  }
  if (!fishingDates.length && !nightFishingDates.length && roomIds.length) {
    throw new Error("Accommodation-only reservations are not available yet");
  }
};

const getMyReservations = async (req, res) => {
  try {
    await ensureSchema();
    const q = await pool.query(`
      SELECT
        r.id,
        r.water_body_id,
        r.user_id,
        COALESCE(r.start_date, r.reservation_date) AS arrival_date,
        COALESCE(r.end_date, r.start_date, r.reservation_date) AS departure_date,
        r.reservation_date,
        r.notes,
        COALESCE(r.requested_spots, r.people_count, 1) AS requested_spots,
        r.people_count,
        r.includes_night_fishing,
        r.wants_housing,
        r.base_amount,
        r.night_fishing_amount,
        r.rooms_amount,
        r.total_amount,
        r.payment_status,
        r.payment_method,
        r.payment_required,
        r.platform_fee_amount,
        r.owner_amount,
        r.stripe_checkout_session_id,
        r.stripe_payment_intent_id,
        r.paid_at,
        r.status,
        r.created_at,
        r.updated_at,
        ((COALESCE(r.end_date, r.start_date, r.reservation_date)::timestamp >= CURRENT_TIMESTAMP) AND r.status IN ('pending', 'approved', 'approved_waiting_payment')) AS can_cancel,
        (COALESCE(r.end_date, r.start_date, r.reservation_date)::date < CURRENT_DATE) AS is_past,
        w.name AS lake_name,
        COALESCE((SELECT json_agg(fishing_date::text ORDER BY fishing_date) FROM reservation_fishing_days WHERE reservation_id = r.id), '[]'::json) AS fishing_dates,
        COALESCE((SELECT json_agg(night_date::text ORDER BY night_date) FROM reservation_night_fishing WHERE reservation_id = r.id), '[]'::json) AS night_fishing_dates,
        COALESCE((SELECT json_agg(ls.spot_number ORDER BY ls.spot_number) FROM reservation_spots rs JOIN lake_spots ls ON ls.id = rs.spot_id WHERE rs.reservation_id = r.id), '[]'::json) AS spot_numbers,
        COALESCE((SELECT json_agg(rm.name ORDER BY rm.name) FROM lake_reservation_rooms rrm JOIN lake_rooms rm ON rm.id = rrm.room_id WHERE rrm.reservation_id = r.id), '[]'::json) AS room_names
      FROM lake_reservations r
      JOIN water_bodies w ON w.id = r.water_body_id
      WHERE r.user_id = $1
      ORDER BY COALESCE(r.start_date, r.reservation_date) DESC, r.created_at DESC
    `, [req.user]);
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load reservations" });
  }
};

const getIncomingReservations = async (req, res) => {
  try {
    await ensureSchema();
    const q = await pool.query(`
      SELECT
        r.id,
        r.water_body_id,
        r.user_id,
        COALESCE(r.start_date, r.reservation_date) AS arrival_date,
        COALESCE(r.end_date, r.start_date, r.reservation_date) AS departure_date,
        r.notes,
        COALESCE(r.requested_spots, r.people_count, 1) AS requested_spots,
        r.includes_night_fishing,
        r.wants_housing,
        r.base_amount,
        r.night_fishing_amount,
        r.rooms_amount,
        r.total_amount,
        r.payment_status,
        r.payment_method,
        r.payment_required,
        r.platform_fee_amount,
        r.owner_amount,
        r.stripe_checkout_session_id,
        r.stripe_payment_intent_id,
        r.paid_at,
        r.status,
        r.created_at,
        r.updated_at,
        (COALESCE(r.end_date, r.start_date, r.reservation_date)::date < CURRENT_DATE) AS is_past,
        w.name AS lake_name,
        u.full_name,
        u.email,
        COALESCE((SELECT json_agg(fishing_date::text ORDER BY fishing_date) FROM reservation_fishing_days WHERE reservation_id = r.id), '[]'::json) AS fishing_dates,
        COALESCE((SELECT json_agg(night_date::text ORDER BY night_date) FROM reservation_night_fishing WHERE reservation_id = r.id), '[]'::json) AS night_fishing_dates,
        COALESCE((SELECT json_agg(ls.spot_number ORDER BY ls.spot_number) FROM reservation_spots rs JOIN lake_spots ls ON ls.id = rs.spot_id WHERE rs.reservation_id = r.id), '[]'::json) AS spot_numbers,
        COALESCE((SELECT json_agg(rm.name ORDER BY rm.name) FROM lake_reservation_rooms rrm JOIN lake_rooms rm ON rm.id = rrm.room_id WHERE rrm.reservation_id = r.id), '[]'::json) AS room_names
      FROM lake_reservations r
      JOIN water_bodies w ON w.id = r.water_body_id
      JOIN users u ON u.id = r.user_id
      WHERE w.owner_id = $1 AND w.is_private = TRUE
      ORDER BY
        CASE r.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
          WHEN 'cancelled' THEN 4
          ELSE 5
        END,
        COALESCE(r.start_date, r.reservation_date) ASC,
        r.created_at DESC
    `, [req.user]);
    res.json(q.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load incoming reservations" });
  }
};


const getReservationBadgeCounts = async (req, res) => {
  try {
    await ensureSchema();

    const userCountQ = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM lake_reservations
      WHERE user_id = $1
        AND status IN ('approved', 'rejected')
        AND COALESCE(end_date, start_date, reservation_date)::timestamp >= CURRENT_TIMESTAMP
    `, [req.user]);

    const ownerCountQ = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM lake_reservations r
      JOIN water_bodies w ON w.id = r.water_body_id
      WHERE w.owner_id = $1
        AND w.is_private = TRUE
        AND r.status = 'pending'
        AND COALESCE(r.end_date, r.start_date, r.reservation_date)::timestamp >= CURRENT_TIMESTAMP
    `, [req.user]);

    res.json({
      user_reservation_updates: Number(userCountQ.rows[0]?.count || 0),
      owner_pending_reservations: Number(ownerCountQ.rows[0]?.count || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load reservation badge counts" });
  }
};

const getMyReservationStatus = async (req, res) => {
  try {
    await ensureSchema();
    const { waterBodyId } = req.params;
    const lake = await getLakeBookingContext(waterBodyId);
    if (!lake) return res.status(404).json({ error: "Lake not found" });
    if (!lake.is_private) return res.json({ is_private: false, reservation: null });
    const q = await pool.query(`
      SELECT id
      FROM lake_reservations
      WHERE water_body_id = $1 AND user_id = $2
      ORDER BY COALESCE(start_date, reservation_date) DESC, created_at DESC
      LIMIT 1
    `, [waterBodyId, req.user]);
    const reservation = q.rows[0] ? await getReservationById(q.rows[0].id) : null;
    res.json({ is_private: true, reservation });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load reservation status" });
  }
};

const estimateReservation = async (req, res) => {
  try {
    await ensureSchema();
    const { water_body_id, room_ids = [], spot_ids = [] } = req.body;
    const { arrival, departure } = normalizeTripDates(req.body);
    const fishingDates = normalizeDateList(req.body.fishing_dates);
    const nightFishingDates = normalizeDateList(req.body.night_fishing_dates);
    const lake = await getLakeBookingContext(water_body_id);
    if (!lake) return res.status(404).json({ error: "Lake not found" });
    const normalizedRoomIds = Array.isArray(room_ids) ? [...new Set(room_ids.map((id) => String(id).trim()).filter(Boolean))] : [];
    const normalizedSpotIds = Array.isArray(spot_ids) ? [...new Set(spot_ids.map((id) => String(id).trim()).filter(Boolean))] : [];
    const selectedRooms = await getRooms(normalizedRoomIds, water_body_id);
    const requestedSpots = Number(req.body.requested_spots || req.body.people_count || 1);
    validateReservationInput({ lake, arrival, departure, requestedSpots, roomIds: normalizedRoomIds, fishingDates, nightFishingDates, selectedSpotIds: normalizedSpotIds });

    const allowedFishingDates = new Set(getAllowedFishingDates(arrival, departure));
    const allowedNightDates = new Set(getAllowedNightDates(arrival, departure));
    if (fishingDates.some((date) => !allowedFishingDates.has(date))) throw new Error("One or more fishing days are outside the selected trip range");
    if (nightFishingDates.some((date) => !allowedNightDates.has(date))) throw new Error("One or more night fishing dates are outside the selected trip range");

    const blockedDates = await getBlockedDateStrings(water_body_id, arrival, departure);
    const usedDates = new Set([...fishingDates, ...nightFishingDates]);
    const blockedUsedDates = blockedDates.filter((date) => usedDates.has(date));
    if (blockedUsedDates.length) throw new Error(`These dates are blocked: ${blockedUsedDates.join(', ')}`);

    if (normalizedSpotIds.length) {
      await ensureSelectedSpotAvailability({ spotIds: normalizedSpotIds, waterBodyId: water_body_id, arrival, departure });
    } else {
      const reservedSpots = await getReservedSpotCount({ waterBodyId: water_body_id, arrival, departure });
      const maxSpots = Math.max(1, toNumber(lake.spots_count, toNumber(lake.capacity, 1)));
      if (reservedSpots + requestedSpots > maxSpots) throw new Error("No remaining spot capacity for the selected dates");
    }
    await ensureRoomAvailability({ roomIds: normalizedRoomIds, arrival, departure });

    const selectedSpots = await getSelectedSpots(normalizedSpotIds, water_body_id);

    const pricing = buildPricing({
      lake,
      requestedSpots,
      fishingDates,
      nightFishingDates,
      selectedRooms,
      stayNightCount: getStayNightCount(arrival, departure),
    });

    res.json({
      arrival_date: arrival,
      departure_date: departure,
      requested_spots: requestedSpots,
      fishing_dates: fishingDates,
      night_fishing_dates: nightFishingDates,
      selected_rooms: selectedRooms.map((room) => ({ id: room.id, name: room.name, price_per_night: room.price_per_night })),
      selected_spots: selectedSpots.map((spot) => ({ id: spot.id, spot_number: spot.spot_number })),
      ...pricing,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to estimate reservation" });
  }
};

const createReservation = async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureSchema();
    const { water_body_id, room_ids = [], spot_ids = [], notes } = req.body;
    const { arrival, departure } = normalizeTripDates(req.body);
    if (!water_body_id) return res.status(400).json({ error: "water_body_id is required" });
    const lake = await getLakeBookingContext(water_body_id);
    if (!lake) return res.status(404).json({ error: "Lake not found" });
    if (String(lake.owner_id) === String(req.user)) return res.status(400).json({ error: "Owner cannot reserve own lake" });

    const paymentMethod = String(req.body.payment_method || req.body.payment_preference || "on_arrival").trim().toLowerCase() === "online"
      ? "online"
      : "on_arrival";

    const fishingDates = normalizeDateList(req.body.fishing_dates);
    const nightFishingDates = normalizeDateList(req.body.night_fishing_dates);
    const normalizedRoomIds = Array.isArray(room_ids) ? [...new Set(room_ids.map((id) => String(id).trim()).filter(Boolean))] : [];
    const normalizedSpotIds = Array.isArray(spot_ids) ? [...new Set(spot_ids.map((id) => String(id).trim()).filter(Boolean))] : [];
    const selectedRooms = await getRooms(normalizedRoomIds, water_body_id);
    if (normalizedRoomIds.length !== selectedRooms.length) return res.status(400).json({ error: "One or more selected rooms are invalid" });

    const requestedSpots = Number(req.body.requested_spots || req.body.people_count || 1);
    validateReservationInput({ lake, arrival, departure, requestedSpots, roomIds: normalizedRoomIds, fishingDates, nightFishingDates, selectedSpotIds: normalizedSpotIds });

    const allowedFishingDates = new Set(getAllowedFishingDates(arrival, departure));
    const allowedNightDates = new Set(getAllowedNightDates(arrival, departure));
    if (fishingDates.some((date) => !allowedFishingDates.has(date))) return res.status(400).json({ error: "One or more fishing days are outside the selected trip range" });
    if (nightFishingDates.some((date) => !allowedNightDates.has(date))) return res.status(400).json({ error: "One or more night fishing dates are outside the selected trip range" });

    const blockedDates = await getBlockedDateStrings(water_body_id, arrival, departure);
    const usedDates = new Set([...fishingDates, ...nightFishingDates]);
    const blockedUsedDates = blockedDates.filter((date) => usedDates.has(date));
    if (blockedUsedDates.length) return res.status(400).json({ error: `These dates are blocked: ${blockedUsedDates.join(', ')}` });

    const selectedSpots = await getSelectedSpots(normalizedSpotIds, water_body_id);
    if (normalizedSpotIds.length) {
      await ensureSelectedSpotAvailability({ spotIds: normalizedSpotIds, waterBodyId: water_body_id, arrival, departure });
    } else {
      const reservedSpots = await getReservedSpotCount({ waterBodyId: water_body_id, arrival, departure });
      const maxSpots = Math.max(1, toNumber(lake.spots_count, toNumber(lake.capacity, 1)));
      if (reservedSpots + requestedSpots > maxSpots) return res.status(400).json({ error: "No remaining spot capacity for the selected dates" });
    }
    await ensureRoomAvailability({ roomIds: normalizedRoomIds, arrival, departure });

    const pricing = buildPricing({
      lake,
      requestedSpots,
      fishingDates,
      nightFishingDates,
      selectedRooms,
      stayNightCount: getStayNightCount(arrival, departure),
    });
    const paymentBreakdown = buildPaymentBreakdown(pricing.totalAmount);
    let initialStatus = "pending";
    let initialPaymentRequired = false;
    let initialPaymentStatus = "unpaid";

    if (paymentMethod === "online" && pricing.totalAmount > 0) {
      const onlinePayment = await canUseOnlinePayments(lake.owner_id);
      if (!onlinePayment.enabled) {
        return res.status(400).json({
          error: onlinePayment.reason || "Online payment is not available for this lake. Choose pay at the lake instead.",
        });
      }
      initialStatus = "approved_waiting_payment";
      initialPaymentRequired = true;
      initialPaymentStatus = "unpaid";
    }

    const snapshotPricePerDay = toNumber(lake.price_per_day, 0);
    const snapshotNightFishingPrice = toNumber(lake.night_fishing_price, 0);

    await client.query("BEGIN");
    const insertReservation = await client.query(`
      INSERT INTO lake_reservations (
        water_body_id,
        user_id,
        reservation_date,
        start_date,
        end_date,
        notes,
        people_count,
        requested_spots,
        includes_night_fishing,
        wants_housing,
        base_amount,
        night_fishing_amount,
        rooms_amount,
        total_amount,
        payment_status,
        payment_method,
        payment_required,
        platform_fee_amount,
        owner_amount,
        snapshot_price_per_day,
        snapshot_night_fishing_price,
        status,
        updated_at
      )
      VALUES ($1, $2, $3, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
      RETURNING id
    `, [
      water_body_id,
      req.user,
      arrival,
      departure,
      String(notes || '').trim() || null,
      requestedSpots,
      nightFishingDates.length > 0,
      normalizedRoomIds.length > 0,
      pricing.baseAmount,
      pricing.nightFishingAmount,
      pricing.roomsAmount,
      pricing.totalAmount,
      initialPaymentStatus,
      paymentMethod,
      initialPaymentRequired,
      paymentBreakdown.platformFeeAmount,
      paymentBreakdown.ownerAmount,
      snapshotPricePerDay,
      snapshotNightFishingPrice,
      initialStatus,
    ]);

    const reservationId = insertReservation.rows[0].id;
    for (const date of fishingDates) {
      await client.query(`INSERT INTO reservation_fishing_days (reservation_id, fishing_date) VALUES ($1, $2)`, [reservationId, date]);
    }
    for (const date of nightFishingDates) {
      await client.query(`INSERT INTO reservation_night_fishing (reservation_id, night_date) VALUES ($1, $2)`, [reservationId, date]);
    }
    for (const roomId of normalizedRoomIds) {
      await client.query(`INSERT INTO lake_reservation_rooms (reservation_id, room_id) VALUES ($1, $2)`, [reservationId, roomId]);
    }
    for (const spot of selectedSpots) {
      await client.query(
        `INSERT INTO reservation_spots (reservation_id, spot_id, price_snapshot) VALUES ($1, $2, $3)`,
        [reservationId, spot.id, toNumber(lake.price_per_day, 0)]
      );
    }
    await client.query("COMMIT");
    const reservation = await getReservationById(reservationId);
    queueReservationEmail(() => notifyReservationCreated(reservationId), "new reservation notification");
    res.json(reservation);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message || "Failed to create reservation" });
  } finally {
    client.release();
  }
};

const cancelReservation = async (req, res) => {
  try {
    await ensureSchema();
    const { reservationId } = req.params;
    const existing = await pool.query(`
      SELECT
        id,
        status,
        COALESCE(end_date, start_date, reservation_date) AS departure_date
      FROM lake_reservations
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `, [reservationId, req.user]);

    if (!existing.rows.length) return res.status(404).json({ error: "Reservation not found" });

    const current = existing.rows[0];
    if (!canUserCancelReservation(current)) {
      return res.status(400).json({
        error: isReservationPast(current)
          ? "Past reservations cannot be cancelled"
          : "Only pending or approved reservations can be cancelled",
      });
    }

    await pool.query(`UPDATE lake_reservations SET status = 'cancelled', payment_required = FALSE, updated_at = NOW() WHERE id = $1 AND user_id = $2`, [reservationId, req.user]);
    await pool.query(`UPDATE reservation_payments SET status = 'cancelled', updated_at = NOW() WHERE reservation_id = $1 AND status = 'pending'`, [reservationId]);
    const reservation = await getReservationById(reservationId);
    queueReservationEmail(() => notifyOwnerReservationCancelled(reservationId), "reservation cancellation notification");
    res.json(reservation);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to cancel reservation" });
  }
};

const updateReservationStatus = async (req, res) => {
  try {
    await ensureSchema();
    const { reservationId } = req.params;
    const { status } = req.body;
    if (!MANAGEABLE_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid reservation status" });
    const reservation = await getReservationById(reservationId);
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });
    if (isReservationPast(reservation)) {
      return res.status(400).json({ error: "Past reservations cannot be changed" });
    }
    const lake = await getLakeBookingContext(reservation.water_body_id);
    if (!lake || String(lake.owner_id) !== String(req.user) || !lake.is_private) return res.status(403).json({ error: "Not allowed" });

    const blockedDates = await getBlockedDateStrings(reservation.water_body_id, reservation.arrival_date, reservation.departure_date);
    const usedDates = [...(reservation.fishing_dates || []), ...(reservation.night_fishing_dates || [])];
    const blockedUsedDates = blockedDates.filter((date) => usedDates.includes(date));
    if (status === 'approved' && blockedUsedDates.length) return res.status(400).json({ error: `These dates are blocked: ${blockedUsedDates.join(', ')}` });
    if (status === 'approved') {
      const spotIds = Array.isArray(reservation.spots) ? reservation.spots.map((spot) => spot.id) : [];
      if (spotIds.length) {
        await ensureSelectedSpotAvailability({
          spotIds,
          waterBodyId: reservation.water_body_id,
          arrival: reservation.arrival_date,
          departure: reservation.departure_date,
          excludedReservationId: reservationId,
        });
      } else {
        const reservedSpots = await getReservedSpotCount({ waterBodyId: reservation.water_body_id, arrival: reservation.arrival_date, departure: reservation.departure_date, excludedReservationId: reservationId });
        const maxSpots = Math.max(1, toNumber(lake.spots_count, toNumber(lake.capacity, 1)));
        if (reservedSpots + Number(reservation.requested_spots || 1) > maxSpots) return res.status(400).json({ error: 'No remaining capacity for the selected dates' });
      }
      const roomIds = Array.isArray(reservation.rooms) ? reservation.rooms.map((room) => room.id) : [];
      await ensureRoomAvailability({ roomIds, arrival: reservation.arrival_date, departure: reservation.departure_date, excludedReservationId: reservationId });
    }
    let nextStatus = status;
    let paymentRequired = false;
    let paymentStatus = reservation.payment_status || "unpaid";

    if (status === "approved" && toNumber(reservation.total_amount, 0) > 0) {
      const onlinePayment = await canUseOnlinePayments(lake.owner_id);
      if (onlinePayment.enabled) {
        nextStatus = "approved_waiting_payment";
        paymentRequired = true;
        paymentStatus = "unpaid";
      }
    }

    if (status === "rejected") {
      paymentRequired = false;
      await pool.query(`UPDATE reservation_payments SET status = 'cancelled', updated_at = NOW() WHERE reservation_id = $1 AND status = 'pending'`, [reservationId]);
    }

    await pool.query(`
      UPDATE lake_reservations
      SET status = $2,
          payment_required = $3,
          payment_status = $4,
          updated_at = NOW()
      WHERE id = $1
    `, [reservationId, nextStatus, paymentRequired, paymentStatus]);
    const updated = await getReservationById(reservationId);
    if (status === "approved" || status === "rejected") {
      queueReservationEmail(() => notifyUserReservationStatusChanged(reservationId, nextStatus), `reservation ${nextStatus} notification`);
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update reservation status' });
  }
};


const createReservationPaymentCheckout = async (req, res) => {
  try {
    await ensureSchema();
    const { reservationId } = req.params;
    const reservation = await getReservationById(reservationId);
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });
    if (String(reservation.user_id) !== String(req.user)) return res.status(403).json({ error: "Not allowed" });
    if (isReservationPast(reservation)) return res.status(400).json({ error: "Past reservations cannot be paid" });
    if (reservation.status !== "approved_waiting_payment") {
      return res.status(400).json({ error: "This reservation is not waiting for online payment" });
    }
    if (reservation.payment_status === "paid") {
      return res.status(400).json({ error: "This reservation is already paid" });
    }
    if (toNumber(reservation.total_amount, 0) <= 0) {
      return res.status(400).json({ error: "This reservation has no online payment amount" });
    }

    const lake = await getLakeBookingContext(reservation.water_body_id);
    if (!lake?.owner_id) return res.status(400).json({ error: "Lake owner is missing" });
    const onlinePayment = await canUseOnlinePayments(lake.owner_id);
    if (!onlinePayment.enabled) {
      return res.status(403).json({ error: onlinePayment.reason || "Owner online payments are not available" });
    }

    const stripe = requireStripe();
    const currency = getReservationCurrency();
    const appUrl = getAppUrl();
    const totalCents = toStripeAmount(reservation.total_amount);
    const platformFeeCents = toStripeAmount(reservation.platform_fee_amount);

    const paymentIntentData = {
      transfer_data: {
        destination: onlinePayment.ownerState.stripe_connected_account_id,
      },
      metadata: {
        reservation_id: String(reservation.id),
        user_id: String(req.user),
        owner_id: String(lake.owner_id),
        water_body_id: String(reservation.water_body_id),
        billing_type: "reservation_payment",
      },
    };
    if (platformFeeCents > 0) {
      paymentIntentData.application_fee_amount = platformFeeCents;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Reservation at ${reservation.lake_name || "Fishing lake"}`,
              description: `Stay: ${reservation.arrival_date} → ${reservation.departure_date}`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/reservations?payment=success`,
      cancel_url: `${appUrl}/reservations?payment=cancelled`,
      payment_intent_data: paymentIntentData,
      metadata: {
        reservation_id: String(reservation.id),
        user_id: String(req.user),
        owner_id: String(lake.owner_id),
        water_body_id: String(reservation.water_body_id),
        billing_type: "reservation_payment",
      },
    });

    await pool.query(`
      INSERT INTO reservation_payments (
        reservation_id, user_id, owner_id, water_body_id, stripe_checkout_session_id,
        stripe_connected_account_id, currency, amount_total, platform_fee_amount, owner_amount, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
      ON CONFLICT (stripe_checkout_session_id) DO UPDATE
      SET status = 'pending', updated_at = NOW()
    `, [
      reservation.id,
      req.user,
      lake.owner_id,
      reservation.water_body_id,
      session.id,
      onlinePayment.ownerState.stripe_connected_account_id,
      currency,
      reservation.total_amount,
      reservation.platform_fee_amount,
      reservation.owner_amount,
    ]);

    await pool.query(`
      UPDATE lake_reservations
      SET stripe_checkout_session_id = $2,
          payment_status = 'checkout_started',
          updated_at = NOW()
      WHERE id = $1
    `, [reservation.id, session.id]);

    res.json({ url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to start reservation payment" });
  }
};

module.exports = {
  getReservationBadgeCounts,
  getMyReservations,
  getIncomingReservations,
  getMyReservationStatus,
  estimateReservation,
  createReservation,
  createReservationPaymentCheckout,
  cancelReservation,
  updateReservationStatus,
};
