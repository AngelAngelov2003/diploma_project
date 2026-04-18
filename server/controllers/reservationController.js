const pool = require("../db");
const { ensureReservationDomainTables } = require("../setup/ensureTables");

const ACTIVE_RESERVATION_STATUSES = ["pending", "approved"];
const MANAGEABLE_STATUSES = ["approved", "rejected", "pending"];

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

const getAllowedFishingDates = (arrival, departure) => {
  if (!arrival || !departure) return [];
  if (arrival === departure) return [arrival];
  const dayBeforeDeparture = new Date(`${departure}T00:00:00Z`);
  dayBeforeDeparture.setUTCDate(dayBeforeDeparture.getUTCDate() - 1);
  return eachDateInclusive(arrival, dayBeforeDeparture.toISOString().slice(0, 10));
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
      AND daterange(r.start_date, r.end_date + INTERVAL '1 day', '[)') && daterange($2::date, $3::date + INTERVAL '1 day', '[)')
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
      AND daterange(r.start_date, r.end_date + INTERVAL '1 day', '[)') && daterange($2::date, $3::date + INTERVAL '1 day', '[)')
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

const validateReservationInput = ({ lake, arrival, departure, requestedSpots, roomIds, fishingDates, nightFishingDates }) => {
  if (!arrival || !departure) {
    throw new Error("arrival_date and departure_date are required");
  }
  if (new Date(`${departure}T00:00:00Z`) < new Date(`${arrival}T00:00:00Z`)) {
    throw new Error("departure_date must be after or equal to arrival_date");
  }
  if (!Number.isInteger(requestedSpots) || requestedSpots < 1) {
    throw new Error("requested_spots must be an integer greater than 0");
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
        r.status,
        r.created_at,
        r.updated_at,
        w.name AS lake_name,
        COALESCE((SELECT json_agg(fishing_date::text ORDER BY fishing_date) FROM reservation_fishing_days WHERE reservation_id = r.id), '[]'::json) AS fishing_dates,
        COALESCE((SELECT json_agg(night_date::text ORDER BY night_date) FROM reservation_night_fishing WHERE reservation_id = r.id), '[]'::json) AS night_fishing_dates,
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
        r.status,
        r.created_at,
        r.updated_at,
        w.name AS lake_name,
        u.full_name,
        u.email,
        COALESCE((SELECT json_agg(fishing_date::text ORDER BY fishing_date) FROM reservation_fishing_days WHERE reservation_id = r.id), '[]'::json) AS fishing_dates,
        COALESCE((SELECT json_agg(night_date::text ORDER BY night_date) FROM reservation_night_fishing WHERE reservation_id = r.id), '[]'::json) AS night_fishing_dates,
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
    const { water_body_id, room_ids = [] } = req.body;
    const { arrival, departure } = normalizeTripDates(req.body);
    const fishingDates = normalizeDateList(req.body.fishing_dates);
    const nightFishingDates = normalizeDateList(req.body.night_fishing_dates);
    const lake = await getLakeBookingContext(water_body_id);
    if (!lake) return res.status(404).json({ error: "Lake not found" });
    const normalizedRoomIds = Array.isArray(room_ids) ? [...new Set(room_ids.map((id) => String(id).trim()).filter(Boolean))] : [];
    const selectedRooms = await getRooms(normalizedRoomIds, water_body_id);
    const requestedSpots = Number(req.body.requested_spots || req.body.people_count || 1);
    validateReservationInput({ lake, arrival, departure, requestedSpots, roomIds: normalizedRoomIds, fishingDates, nightFishingDates });

    const allowedFishingDates = new Set(getAllowedFishingDates(arrival, departure));
    const allowedNightDates = new Set(getAllowedNightDates(arrival, departure));
    if (fishingDates.some((date) => !allowedFishingDates.has(date))) throw new Error("One or more fishing days are outside the selected trip range");
    if (nightFishingDates.some((date) => !allowedNightDates.has(date))) throw new Error("One or more night fishing dates are outside the selected trip range");

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
    const { water_body_id, room_ids = [], notes } = req.body;
    const { arrival, departure } = normalizeTripDates(req.body);
    if (!water_body_id) return res.status(400).json({ error: "water_body_id is required" });
    const lake = await getLakeBookingContext(water_body_id);
    if (!lake) return res.status(404).json({ error: "Lake not found" });
    if (String(lake.owner_id) === String(req.user)) return res.status(400).json({ error: "Owner cannot reserve own lake" });

    const fishingDates = normalizeDateList(req.body.fishing_dates);
    const nightFishingDates = normalizeDateList(req.body.night_fishing_dates);
    const normalizedRoomIds = Array.isArray(room_ids) ? [...new Set(room_ids.map((id) => String(id).trim()).filter(Boolean))] : [];
    const selectedRooms = await getRooms(normalizedRoomIds, water_body_id);
    if (normalizedRoomIds.length !== selectedRooms.length) return res.status(400).json({ error: "One or more selected rooms are invalid" });

    const requestedSpots = Number(req.body.requested_spots || req.body.people_count || 1);
    validateReservationInput({ lake, arrival, departure, requestedSpots, roomIds: normalizedRoomIds, fishingDates, nightFishingDates });

    const allowedFishingDates = new Set(getAllowedFishingDates(arrival, departure));
    const allowedNightDates = new Set(getAllowedNightDates(arrival, departure));
    if (fishingDates.some((date) => !allowedFishingDates.has(date))) return res.status(400).json({ error: "One or more fishing days are outside the selected trip range" });
    if (nightFishingDates.some((date) => !allowedNightDates.has(date))) return res.status(400).json({ error: "One or more night fishing dates are outside the selected trip range" });

    const blockedDates = await getBlockedDateStrings(water_body_id, arrival, departure);
    const usedDates = new Set([...fishingDates, ...nightFishingDates]);
    const blockedUsedDates = blockedDates.filter((date) => usedDates.has(date));
    if (blockedUsedDates.length) return res.status(400).json({ error: `These dates are blocked: ${blockedUsedDates.join(', ')}` });

    const reservedSpots = await getReservedSpotCount({ waterBodyId: water_body_id, arrival, departure });
    const maxSpots = Math.max(1, toNumber(lake.spots_count, toNumber(lake.capacity, 1)));
    if (reservedSpots + requestedSpots > maxSpots) return res.status(400).json({ error: "No remaining spot capacity for the selected dates" });
    await ensureRoomAvailability({ roomIds: normalizedRoomIds, arrival, departure });

    const pricing = buildPricing({
      lake,
      requestedSpots,
      fishingDates,
      nightFishingDates,
      selectedRooms,
      stayNightCount: getStayNightCount(arrival, departure),
    });

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
        status,
        updated_at
      )
      VALUES ($1, $2, $3, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, 'pending', NOW())
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
    await client.query("COMMIT");
    const reservation = await getReservationById(reservationId);
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
    const existing = await pool.query(`SELECT id FROM lake_reservations WHERE id = $1 AND user_id = $2`, [reservationId, req.user]);
    if (!existing.rows.length) return res.status(404).json({ error: "Reservation not found" });
    await pool.query(`UPDATE lake_reservations SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND user_id = $2`, [reservationId, req.user]);
    const reservation = await getReservationById(reservationId);
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
    const lake = await getLakeBookingContext(reservation.water_body_id);
    if (!lake || String(lake.owner_id) !== String(req.user) || !lake.is_private) return res.status(403).json({ error: "Not allowed" });

    const blockedDates = await getBlockedDateStrings(reservation.water_body_id, reservation.arrival_date, reservation.departure_date);
    const usedDates = [...(reservation.fishing_dates || []), ...(reservation.night_fishing_dates || [])];
    const blockedUsedDates = blockedDates.filter((date) => usedDates.includes(date));
    if (status === 'approved' && blockedUsedDates.length) return res.status(400).json({ error: `These dates are blocked: ${blockedUsedDates.join(', ')}` });
    if (status === 'approved') {
      const reservedSpots = await getReservedSpotCount({ waterBodyId: reservation.water_body_id, arrival: reservation.arrival_date, departure: reservation.departure_date, excludedReservationId: reservationId });
      const maxSpots = Math.max(1, toNumber(lake.spots_count, toNumber(lake.capacity, 1)));
      if (reservedSpots + Number(reservation.requested_spots || 1) > maxSpots) return res.status(400).json({ error: 'No remaining capacity for the selected dates' });
      const roomIds = Array.isArray(reservation.rooms) ? reservation.rooms.map((room) => room.id) : [];
      await ensureRoomAvailability({ roomIds, arrival: reservation.arrival_date, departure: reservation.departure_date, excludedReservationId: reservationId });
    }
    await pool.query(`UPDATE lake_reservations SET status = $2, updated_at = NOW() WHERE id = $1`, [reservationId, status]);
    const updated = await getReservationById(reservationId);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update reservation status' });
  }
};

module.exports = {
  getMyReservations,
  getIncomingReservations,
  getMyReservationStatus,
  estimateReservation,
  createReservation,
  cancelReservation,
  updateReservationStatus,
};
