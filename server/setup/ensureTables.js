const pool = require("../db");

const ensureAlertJobRunsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_job_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_name TEXT NOT NULL,
      run_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (job_name, run_date)
    )
  `);
};

const ensureUserNotificationPreferencesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notification_preferences (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      default_notification_frequency TEXT NOT NULL DEFAULT 'daily',
      default_min_score INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT user_notification_preferences_frequency_check
        CHECK (default_notification_frequency IN ('daily', 'weekly')),
      CONSTRAINT user_notification_preferences_min_score_check
        CHECK (default_min_score >= 0 AND default_min_score <= 100)
    )
  `);

  await pool.query(`
    INSERT INTO user_notification_preferences (user_id)
    SELECT id
    FROM users
    ON CONFLICT (user_id) DO NOTHING
  `);
};

const ensureLakeOwnerClaimRequestsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lake_owner_claim_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(50),
      company_name VARCHAR(150),
      message TEXT,
      proof_document_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT lake_owner_claim_requests_status_check
        CHECK (status IN ('pending', 'approved', 'rejected'))
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_claim_per_user_lake
    ON lake_owner_claim_requests (water_body_id, user_id)
    WHERE status = 'pending'
  `);
};

const ensureSubscriptionDeliveriesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_deliveries (
      id SERIAL PRIMARY KEY,
      subscription_id INTEGER NOT NULL REFERENCES lake_subscriptions(id) ON DELETE CASCADE,
      delivery_date DATE NOT NULL,
      sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'sent',
      error TEXT,
      UNIQUE (subscription_id, delivery_date)
    )
  `);
};

module.exports = {
  ensureAlertJobRunsTable,
  ensureUserNotificationPreferencesTable,
  ensureLakeOwnerClaimRequestsTable,
  ensureSubscriptionDeliveriesTable,
};