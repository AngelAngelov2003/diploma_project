const pool = require("../db");

const ensureAlertJobRunsTable = async () => {};

const ensureUserAccountFlags = async () => {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
  `);

  await pool.query(`
    ALTER TABLE users
    ALTER COLUMN is_verified SET DEFAULT FALSE,
    ALTER COLUMN is_active SET DEFAULT TRUE
  `);

  
  await pool.query(`
    UPDATE users
    SET is_verified = TRUE, updated_at = NOW()
    WHERE role = 'admin' AND is_verified IS DISTINCT FROM TRUE
  `);
};

const ensureUserNotificationPreferencesTable = async () => {};
const ensureLakeOwnerClaimRequestsTable = async () => {};
const ensureSubscriptionDeliveriesTable = async () => {};

const ensurePasswordResetTokensTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
    ON password_reset_tokens(user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
    ON password_reset_tokens(expires_at)
  `);
};



const ensureEmailVerificationTokensTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
    ON email_verification_tokens(user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at
    ON email_verification_tokens(expires_at)
  `);
};

const ensureBillingTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_billing_profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      stripe_customer_id TEXT UNIQUE,
      stripe_subscription_id TEXT,
      subscription_tier TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL DEFAULT 'inactive',
      current_period_end TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS owner_billing_profiles (
      owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      stripe_customer_id TEXT UNIQUE,
      stripe_subscription_id TEXT,
      owner_plan TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL DEFAULT 'inactive',
      current_period_end TIMESTAMP,
      stripe_connected_account_id TEXT UNIQUE,
      connect_onboarding_status TEXT NOT NULL DEFAULT 'not_started',
      charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      stripe_event_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload JSONB,
      processed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    INSERT INTO user_billing_profiles (user_id)
    SELECT id FROM users
    ON CONFLICT (user_id) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO owner_billing_profiles (owner_id)
    SELECT id FROM users
    WHERE LOWER(COALESCE(role, '')) IN ('owner', 'admin')
    ON CONFLICT (owner_id) DO NOTHING
  `);
};

const RESERVATION_DOMAIN_LOCK_KEY = 42891731;

const ensureReservationDomainTables = async () => {
  const client = await pool.connect();
  const run = (...args) => client.query(...args);

  await run("SELECT pg_advisory_lock($1)", [RESERVATION_DOMAIN_LOCK_KEY]);

  try {
      await run(`
        ALTER TABLE water_bodies
        ADD COLUMN IF NOT EXISTS allows_night_fishing BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS night_fishing_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS has_housing BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS spots_count INTEGER NOT NULL DEFAULT 0
      `);


      await run(`
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

      await run(`
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

      await run(`
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

      await run(`
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

      await run(`
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



      await run(`
        CREATE TABLE IF NOT EXISTS lake_user_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
          catch_id UUID REFERENCES catch_logs(id) ON DELETE SET NULL,
          reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMP
        )
      `);
      await run(`
        ALTER TABLE lake_reservations
        DROP CONSTRAINT IF EXISTS lake_reservations_water_body_id_user_id_reservation_date_key
      `);

      await run(`
        ALTER TABLE lake_reservations
        DROP CONSTRAINT IF EXISTS lake_reservations_status_check
      `);

      await run(`
        ALTER TABLE lake_reservations
        ADD CONSTRAINT lake_reservations_status_check
        CHECK (status IN ('pending', 'approved', 'approved_waiting_payment', 'rejected', 'cancelled', 'canceled'))
      `);

      await run(`
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
        ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
        ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'on_arrival',
        ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS owner_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS snapshot_price_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS snapshot_night_fishing_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
        ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP
      `);

      await run(`
        UPDATE lake_reservations
        SET start_date = COALESCE(start_date, reservation_date)
      `);

      await run(`
        UPDATE lake_reservations
        SET end_date = COALESCE(end_date, start_date, reservation_date)
      `);

      await run(`
        UPDATE lake_reservations
        SET requested_spots = COALESCE(NULLIF(people_count, 0), requested_spots, 1)
      `);

      await run(`
        ALTER TABLE lake_reservations
        ALTER COLUMN start_date SET NOT NULL,
        ALTER COLUMN end_date SET NOT NULL
      `);

      await run(`
        CREATE TABLE IF NOT EXISTS lake_reservation_rooms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reservation_id UUID NOT NULL REFERENCES lake_reservations(id) ON DELETE CASCADE,
          room_id UUID NOT NULL REFERENCES lake_rooms(id) ON DELETE CASCADE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (reservation_id, room_id)
        )
      `);

      await run(`
        CREATE TABLE IF NOT EXISTS reservation_spots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reservation_id UUID NOT NULL REFERENCES lake_reservations(id) ON DELETE CASCADE,
          spot_id UUID NOT NULL REFERENCES lake_spots(id) ON DELETE CASCADE,
          price_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (reservation_id, spot_id)
        )
      `);

      await run(`
        CREATE TABLE IF NOT EXISTS reservation_fishing_days (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reservation_id UUID NOT NULL REFERENCES lake_reservations(id) ON DELETE CASCADE,
          fishing_date DATE NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (reservation_id, fishing_date)
        )
      `);

      await run(`
        CREATE TABLE IF NOT EXISTS reservation_night_fishing (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reservation_id UUID NOT NULL REFERENCES lake_reservations(id) ON DELETE CASCADE,
          night_date DATE NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (reservation_id, night_date)
        )
      `);



      await run(`
        CREATE TABLE IF NOT EXISTS reservation_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reservation_id UUID NOT NULL REFERENCES lake_reservations(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
          water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
          stripe_checkout_session_id TEXT UNIQUE,
          stripe_payment_intent_id TEXT,
          stripe_connected_account_id TEXT,
          currency TEXT NOT NULL DEFAULT 'eur',
          amount_total NUMERIC(10,2) NOT NULL DEFAULT 0,
          platform_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
          owner_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          paid_at TIMESTAMP
        )
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_reservation_payments_reservation_id
        ON reservation_payments (reservation_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_reservation_payments_owner_id
        ON reservation_payments (owner_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_reservation_payments_status
        ON reservation_payments (status)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_lake_sectors_water_body_id
        ON lake_sectors (water_body_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_lake_spots_water_body_id
        ON lake_spots (water_body_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_lake_rooms_water_body_id
        ON lake_rooms (water_body_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_lake_gallery_photos_water_body_id
        ON lake_gallery_photos (water_body_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_lake_user_reports_water_body_id
        ON lake_user_reports (water_body_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_lake_reservations_date_range
        ON lake_reservations (water_body_id, start_date, end_date, status)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_lake_reservation_rooms_reservation_id
        ON lake_reservation_rooms (reservation_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_reservation_spots_reservation_id
        ON reservation_spots (reservation_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_reservation_spots_spot_id
        ON reservation_spots (spot_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_reservation_fishing_days_reservation_id
        ON reservation_fishing_days (reservation_id)
      `);

      await run(`
        CREATE INDEX IF NOT EXISTS idx_reservation_night_fishing_reservation_id
        ON reservation_night_fishing (reservation_id)
      `);
  } finally {
    await run("SELECT pg_advisory_unlock($1)", [RESERVATION_DOMAIN_LOCK_KEY]);
    client.release();
  }
};

module.exports = {
  ensureAlertJobRunsTable,
  ensureUserAccountFlags,
  ensureUserNotificationPreferencesTable,
  ensureLakeOwnerClaimRequestsTable,
  ensureSubscriptionDeliveriesTable,
  ensureBillingTables,
  ensurePasswordResetTokensTable,
  ensureEmailVerificationTokensTable,
  ensureReservationDomainTables,
};