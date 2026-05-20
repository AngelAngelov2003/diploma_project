const pool = require("../db");

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const CONNECT_READY_STATUSES = new Set(["complete", "enabled"]);

const normalizeTier = (tier) => {
  const value = String(tier || "free").toLowerCase();
  return value === "premium" ? "premium" : "free";
};

const normalizeOwnerPlan = (plan) => {
  const value = String(plan || "free").toLowerCase();
  return value === "pro" ? "pro" : "free";
};

const isPremiumBilling = (billing) => {
  if (!billing) return false;
  return normalizeTier(billing.subscription_tier) === "premium" && ACTIVE_STATUSES.has(String(billing.subscription_status || "").toLowerCase());
};

const isOwnerProBilling = (billing) => {
  if (!billing) return false;
  return normalizeOwnerPlan(billing.owner_plan) === "pro" && ACTIVE_STATUSES.has(String(billing.subscription_status || "").toLowerCase());
};

const isOwnerConnectReady = (billing) => {
  if (!billing) return false;
  return Boolean(billing.stripe_connected_account_id) && CONNECT_READY_STATUSES.has(String(billing.connect_onboarding_status || "").toLowerCase());
};

const roleHasPremiumAccess = (role) => ["admin", "owner"].includes(String(role || "user").toLowerCase());

const getOrCreateUserBillingProfile = async (userId) => {
  await pool.query(
    `
      INSERT INTO user_billing_profiles (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );

  const q = await pool.query(
    `
      SELECT user_id, stripe_customer_id, stripe_subscription_id, subscription_tier,
             subscription_status, current_period_end, created_at, updated_at
      FROM user_billing_profiles
      WHERE user_id = $1
    `,
    [userId]
  );

  return q.rows[0] || null;
};

const getOrCreateOwnerBillingProfile = async (ownerId) => {
  await pool.query(
    `
      INSERT INTO owner_billing_profiles (owner_id)
      VALUES ($1)
      ON CONFLICT (owner_id) DO NOTHING
    `,
    [ownerId]
  );

  const q = await pool.query(
    `
      SELECT owner_id, stripe_customer_id, stripe_subscription_id, owner_plan,
             subscription_status, current_period_end, stripe_connected_account_id,
             connect_onboarding_status, charges_enabled, payouts_enabled,
             details_submitted, created_at, updated_at
      FROM owner_billing_profiles
      WHERE owner_id = $1
    `,
    [ownerId]
  );

  return q.rows[0] || null;
};

const getUserPremiumState = async (userId, role = "user") => {
  const billing = await getOrCreateUserBillingProfile(userId);
  const hasPremiumAccess = roleHasPremiumAccess(role) || isPremiumBilling(billing);

  return {
    subscription_tier: billing?.subscription_tier || "free",
    subscription_status: billing?.subscription_status || "inactive",
    current_period_end: billing?.current_period_end || null,
    has_premium_access: hasPremiumAccess,
  };
};

const getOwnerBillingState = async (ownerId, role = "user") => {
  const billing = await getOrCreateOwnerBillingProfile(ownerId);
  const normalizedRole = String(role || "user").toLowerCase();
  const isAdmin = normalizedRole === "admin";
  const hasOwnerProAccess = isAdmin || isOwnerProBilling(billing);
  const connectReady = isOwnerConnectReady(billing);

  return {
    owner_plan: billing?.owner_plan || "free",
    subscription_status: billing?.subscription_status || "inactive",
    current_period_end: billing?.current_period_end || null,
    has_owner_pro_access: hasOwnerProAccess,
    stripe_connected_account_id: billing?.stripe_connected_account_id || null,
    connect_onboarding_status: billing?.connect_onboarding_status || "not_started",
    charges_enabled: Boolean(billing?.charges_enabled),
    payouts_enabled: Boolean(billing?.payouts_enabled),
    details_submitted: Boolean(billing?.details_submitted),
    connect_ready: connectReady,
  };
};

const setStripeCustomerId = async (userId, stripeCustomerId) => {
  const q = await pool.query(
    `
      UPDATE user_billing_profiles
      SET stripe_customer_id = $2, updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `,
    [userId, stripeCustomerId]
  );

  return q.rows[0] || null;
};

const setOwnerStripeCustomerId = async (ownerId, stripeCustomerId) => {
  const q = await pool.query(
    `
      UPDATE owner_billing_profiles
      SET stripe_customer_id = $2, updated_at = NOW()
      WHERE owner_id = $1
      RETURNING *
    `,
    [ownerId, stripeCustomerId]
  );

  return q.rows[0] || null;
};

const setOwnerConnectedAccount = async (ownerId, account) => {
  const accountId = typeof account === "string" ? account : account?.id;
  const chargesEnabled = Boolean(account?.charges_enabled);
  const payoutsEnabled = Boolean(account?.payouts_enabled);
  const detailsSubmitted = Boolean(account?.details_submitted);
  const onboardingStatus = detailsSubmitted || chargesEnabled || payoutsEnabled ? "complete" : "pending";

  const q = await pool.query(
    `
      UPDATE owner_billing_profiles
      SET stripe_connected_account_id = $2,
          connect_onboarding_status = $3,
          charges_enabled = $4,
          payouts_enabled = $5,
          details_submitted = $6,
          updated_at = NOW()
      WHERE owner_id = $1
      RETURNING *
    `,
    [ownerId, accountId || null, onboardingStatus, chargesEnabled, payoutsEnabled, detailsSubmitted]
  );

  return q.rows[0] || null;
};

const updateOwnerConnectStatusByAccountId = async (account) => {
  const accountId = typeof account === "string" ? account : account?.id;
  if (!accountId) return null;
  const chargesEnabled = Boolean(account?.charges_enabled);
  const payoutsEnabled = Boolean(account?.payouts_enabled);
  const detailsSubmitted = Boolean(account?.details_submitted);
  const onboardingStatus = detailsSubmitted || chargesEnabled || payoutsEnabled ? "complete" : "pending";

  const q = await pool.query(
    `
      UPDATE owner_billing_profiles
      SET connect_onboarding_status = $2,
          charges_enabled = $3,
          payouts_enabled = $4,
          details_submitted = $5,
          updated_at = NOW()
      WHERE stripe_connected_account_id = $1
      RETURNING *
    `,
    [accountId, onboardingStatus, chargesEnabled, payoutsEnabled, detailsSubmitted]
  );

  return q.rows[0] || null;
};

const updateSubscriptionByCustomer = async ({
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  tier = "premium",
  currentPeriodEnd,
}) => {
  const isActive = ACTIVE_STATUSES.has(String(status || "").toLowerCase());
  const nextTier = isActive ? normalizeTier(tier) : "free";

  const q = await pool.query(
    `
      UPDATE user_billing_profiles
      SET stripe_subscription_id = $2,
          subscription_status = $3,
          subscription_tier = $4,
          current_period_end = $5,
          updated_at = NOW()
      WHERE stripe_customer_id = $1
      RETURNING *
    `,
    [stripeCustomerId, stripeSubscriptionId || null, status || "inactive", nextTier, currentPeriodEnd || null]
  );

  return q.rows[0] || null;
};

const updateOwnerSubscriptionByCustomer = async ({
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  plan = "pro",
  currentPeriodEnd,
}) => {
  const isActive = ACTIVE_STATUSES.has(String(status || "").toLowerCase());
  const nextPlan = isActive ? normalizeOwnerPlan(plan) : "free";

  const q = await pool.query(
    `
      UPDATE owner_billing_profiles
      SET stripe_subscription_id = $2,
          subscription_status = $3,
          owner_plan = $4,
          current_period_end = $5,
          updated_at = NOW()
      WHERE stripe_customer_id = $1
      RETURNING *
    `,
    [stripeCustomerId, stripeSubscriptionId || null, status || "inactive", nextPlan, currentPeriodEnd || null]
  );

  return q.rows[0] || null;
};



const markReservationPaymentPaid = async ({
  checkoutSessionId,
  paymentIntentId,
  reservationId,
}) => {
  const params = [checkoutSessionId || null, paymentIntentId || null, reservationId || null];

  const paymentQ = await pool.query(
    `
      UPDATE reservation_payments
      SET status = 'paid',
          stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
          paid_at = NOW(),
          updated_at = NOW()
      WHERE ($1::text IS NOT NULL AND stripe_checkout_session_id = $1)
         OR ($3::uuid IS NOT NULL AND reservation_id = $3)
      RETURNING reservation_id
    `,
    params
  );

  const targetReservationId = reservationId || paymentQ.rows[0]?.reservation_id;
  if (!targetReservationId) return null;

  const reservationQ = await pool.query(
    `
      UPDATE lake_reservations
      SET payment_status = 'paid',
          payment_required = FALSE,
          stripe_checkout_session_id = COALESCE($1, stripe_checkout_session_id),
          stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
          paid_at = NOW(),
          status = 'approved',
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [checkoutSessionId || null, paymentIntentId || null, targetReservationId]
  );

  return reservationQ.rows[0] || null;
};

const markReservationPaymentFailed = async ({ checkoutSessionId, reservationId }) => {
  await pool.query(
    `
      UPDATE reservation_payments
      SET status = 'failed', updated_at = NOW()
      WHERE ($1::text IS NOT NULL AND stripe_checkout_session_id = $1)
         OR ($2::uuid IS NOT NULL AND reservation_id = $2)
    `,
    [checkoutSessionId || null, reservationId || null]
  );

  if (reservationId) {
    await pool.query(
      `
        UPDATE lake_reservations
        SET payment_status = 'failed', updated_at = NOW()
        WHERE id = $1 AND status = 'approved_waiting_payment'
      `,
      [reservationId]
    );
  }
};

const recordStripeWebhookEvent = async (event) => {
  await pool.query(
    `
      INSERT INTO stripe_webhook_events (stripe_event_id, type, payload)
      VALUES ($1, $2, $3)
      ON CONFLICT (stripe_event_id) DO NOTHING
    `,
    [event.id, event.type, event]
  );
};

module.exports = {
  getOrCreateUserBillingProfile,
  getOrCreateOwnerBillingProfile,
  getUserPremiumState,
  getOwnerBillingState,
  setStripeCustomerId,
  setOwnerStripeCustomerId,
  setOwnerConnectedAccount,
  updateOwnerConnectStatusByAccountId,
  updateSubscriptionByCustomer,
  updateOwnerSubscriptionByCustomer,
  markReservationPaymentPaid,
  markReservationPaymentFailed,
  recordStripeWebhookEvent,
  isPremiumBilling,
  isOwnerProBilling,
  isOwnerConnectReady,
  roleHasPremiumAccess,
};
