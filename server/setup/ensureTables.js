const pool = require("../db");

const ensureAlertJobRunsTable = async () => {};
const ensureUserNotificationPreferencesTable = async () => {};
const ensureLakeOwnerClaimRequestsTable = async () => {};
const ensureSubscriptionDeliveriesTable = async () => {};

const ensureReservationDomainTables = async () => {
  await pool.query(`
    ALTER TABLE water_bodies
    ADD COLUMN IF NOT EXISTS allows_night_fishing BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS night_fishing_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_housing BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS spots_count INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lake_sectors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      spots_count INTEGER NOT NULL CHECK (spots_count > 0),
      price_per_day NUMERIC(10,2),
      night_fishing_allowed BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (water_body_id, name)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lake_spots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
      spot_number INTEGER NOT NULL CHECK (spot_number > 0),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (water_body_id, spot_number)
    )
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lake_spots' AND column_name = 'lake_id'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lake_spots' AND column_name = 'water_body_id'
      ) THEN
        ALTER TABLE lake_spots RENAME COLUMN lake_id TO water_body_id;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lake_rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
      price_per_night NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price_per_night >= 0),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (water_body_id, name)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lake_gallery_photos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      caption TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE lake_reservations
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE,
    ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES lake_sectors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS requested_spots INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS includes_night_fishing BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS wants_housing BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS night_fishing_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rooms_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) NOT NULL DEFAULT 0
  `);

  await pool.query(`
    UPDATE lake_reservations
    SET start_date = COALESCE(start_date, reservation_date)
  `);

  await pool.query(`
    UPDATE lake_reservations
    SET end_date = COALESCE(end_date, start_date, reservation_date)
  `);

  await pool.query(`
    UPDATE lake_reservations
    SET requested_spots = COALESCE(NULLIF(people_count, 0), requested_spots, 1)
  `);

  await pool.query(`
    ALTER TABLE lake_reservations
    ALTER COLUMN start_date SET NOT NULL,
    ALTER COLUMN end_date SET NOT NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lake_reservation_rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reservation_id UUID NOT NULL REFERENCES lake_reservations(id) ON DELETE CASCADE,
      room_id UUID NOT NULL REFERENCES lake_rooms(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (reservation_id, room_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservation_fishing_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reservation_id UUID NOT NULL REFERENCES lake_reservations(id) ON DELETE CASCADE,
      fishing_date DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (reservation_id, fishing_date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservation_night_fishing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reservation_id UUID NOT NULL REFERENCES lake_reservations(id) ON DELETE CASCADE,
      night_date DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (reservation_id, night_date)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lake_sectors_water_body_id
    ON lake_sectors (water_body_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lake_spots_water_body_id
    ON lake_spots (water_body_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lake_rooms_water_body_id
    ON lake_rooms (water_body_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lake_gallery_photos_water_body_id
    ON lake_gallery_photos (water_body_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lake_reservations_date_range
    ON lake_reservations (water_body_id, start_date, end_date, status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lake_reservation_rooms_reservation_id
    ON lake_reservation_rooms (reservation_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reservation_fishing_days_reservation_id
    ON reservation_fishing_days (reservation_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reservation_night_fishing_reservation_id
    ON reservation_night_fishing (reservation_id)
  `);
};

module.exports = {
  ensureAlertJobRunsTable,
  ensureUserNotificationPreferencesTable,
  ensureLakeOwnerClaimRequestsTable,
  ensureSubscriptionDeliveriesTable,
  ensureReservationDomainTables,
};