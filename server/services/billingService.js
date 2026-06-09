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
  const hasOwnerAccess = ["owner", "admin"].includes(normalizedRole);
  const connectReady = isOwnerConnectReady(billing);

  return {
    owner_plan: "commission",
    subscription_status: "not_required",
    current_period_end: null,
    has_owner_pro_access: hasOwnerAccess,
    stripe_connected_account_id: billing?.stripe_connected_account_id || null,
    connect_onboarding_status: billing?.connect_onboarding_status || "not_started",
    charges_enabled: Boolean(billing?.charges_enabled),
    payouts_enabled: Boolean(billing?.payouts_enabled),
    details_submitted: Boolean(billing?.details_submitted),
    connect_ready: connectReady,
    platform_fee_percent: Number(process.env.PLATFORM_FEE_PERCENT || 10),
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



const centsToMajor = (amount) => Number((Number(amount || 0) / 100).toFixed(2));


const getWeekdayLabel = (weekday) => ({
  monday: "понеделник",
  tuesday: "вторник",
  wednesday: "сряда",
  thursday: "четвъртък",
  friday: "петък",
  saturday: "събота",
  sunday: "неделя",
}[String(weekday || "").toLowerCase()] || weekday || "избрания ден от седмицата");

const summarizeStripeBalance = (balance, preferredCurrency = "eur") => {
  const currency = String(preferredCurrency || "eur").toLowerCase();
  const sumForCurrency = (items = []) => items
    .filter((item) => String(item.currency || "").toLowerCase() === currency)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    currency,
    available: centsToMajor(sumForCurrency(balance?.available || [])),
    pending: centsToMajor(sumForCurrency(balance?.pending || [])),
  };
};

const formatPayoutSchedule = (account) => {
  const schedule = account?.settings?.payouts?.schedule;
  if (!schedule) return "Автоматичните изплащания зависят от настройките на Stripe акаунта.";

  if (schedule.interval === "weekly") {
    const weekday = getWeekdayLabel(schedule.weekly_anchor);
    return `Седмични автоматични изплащания, обикновено в ${weekday}.`;
  }

  if (schedule.interval === "monthly") {
    const day = schedule.monthly_anchor ? `ден ${schedule.monthly_anchor}` : "избрания ден";
    return `Месечни автоматични изплащания, обикновено на ${day}.`;
  }

  if (schedule.interval === "daily") return "Дневни автоматични изплащания след периода на наличност в Stripe.";
  if (schedule.interval === "manual") return "Включени са ръчни изплащания; те трябва да се стартират от Stripe.";

  return `${schedule.interval || "Автоматичен"} график за изплащания.`;
};

const getOwnerRevenueSummary = async (ownerId, stripe = null) => {
  const billing = await getOrCreateOwnerBillingProfile(ownerId);
  const currency = String(process.env.STRIPE_RESERVATION_CURRENCY || "eur").toLowerCase();

  const totalsQ = await pool.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_total ELSE 0 END), 0)::numeric AS total_volume,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN platform_fee_amount ELSE 0 END), 0)::numeric AS platform_fees,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN owner_amount ELSE 0 END), 0)::numeric AS owner_earnings,
        COALESCE(SUM(CASE WHEN status IN ('pending', 'checkout_started') THEN owner_amount ELSE 0 END), 0)::numeric AS pending_checkout_amount,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_payments_count
      FROM reservation_payments
      WHERE owner_id = $1::uuid
    `,
    [ownerId]
  );

  const historyQ = await pool.query(
    `
      SELECT
        rp.id,
        rp.reservation_id,
        rp.water_body_id,
        rp.currency,
        rp.amount_total,
        rp.platform_fee_amount,
        rp.owner_amount,
        rp.status,
        rp.created_at,
        rp.paid_at,
        w.name AS lake_name,
        u.full_name AS customer_name,
        u.email AS customer_email,
        COALESCE(lr.start_date, lr.reservation_date)::text AS arrival_date,
        COALESCE(lr.end_date, lr.start_date, lr.reservation_date)::text AS departure_date
      FROM reservation_payments rp
      LEFT JOIN water_bodies w ON w.id = rp.water_body_id
      LEFT JOIN users u ON u.id = rp.user_id
      LEFT JOIN lake_reservations lr ON lr.id = rp.reservation_id
      WHERE rp.owner_id = $1::uuid
      ORDER BY COALESCE(rp.paid_at, rp.created_at) DESC
      LIMIT 12
    `,
    [ownerId]
  );

  let stripeBalance = { currency, available: 0, pending: 0 };
  let payoutSchedule = billing?.payouts_enabled
    ? "Автоматичните изплащания са включени в Stripe."
    : "Изплащанията все още не са включени.";

  if (stripe && billing?.stripe_connected_account_id) {
    try {
      const [balance, account] = await Promise.all([
        stripe.balance.retrieve({}, { stripeAccount: billing.stripe_connected_account_id }),
        stripe.accounts.retrieve(billing.stripe_connected_account_id),
      ]);
      stripeBalance = summarizeStripeBalance(balance, currency);
      payoutSchedule = formatPayoutSchedule(account);
    } catch (error) {
      console.warn("[billing] Неуспешно зареждане на Stripe баланса на собственика:", error.message);
    }
  }

  const row = totalsQ.rows[0] || {};

  return {
    currency,
    total_earnings: Number(row.owner_earnings || 0),
    pending_balance: stripeBalance.pending,
    available_balance: stripeBalance.available,
    estimated_next_payout: payoutSchedule,
    total_reservation_volume: Number(row.total_volume || 0),
    platform_fees: Number(row.platform_fees || 0),
    pending_checkout_amount: Number(row.pending_checkout_amount || 0),
    paid_payments_count: Number(row.paid_payments_count || 0),
    history: historyQ.rows,
  };
};

const getAdminRevenueSummary = async () => {
  const paymentsQ = await pool.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_total ELSE 0 END), 0)::numeric AS total_volume,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN platform_fee_amount ELSE 0 END), 0)::numeric AS platform_commissions,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN owner_amount ELSE 0 END), 0)::numeric AS owner_earnings,
        COALESCE(SUM(CASE WHEN status IN ('pending', 'checkout_started') THEN amount_total ELSE 0 END), 0)::numeric AS pending_checkout_volume,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_payments_count,
        COUNT(*) FILTER (WHERE status IN ('pending', 'checkout_started'))::int AS pending_payments_count
      FROM reservation_payments
    `
  );

  const ownerStatusesQ = await pool.query(
    `
      SELECT
        obp.owner_id,
        u.full_name,
        u.email,
        obp.stripe_connected_account_id,
        obp.connect_onboarding_status,
        obp.charges_enabled,
        obp.payouts_enabled,
        obp.details_submitted,
        obp.updated_at,
        COUNT(w.id)::int AS owned_lakes_count
      FROM owner_billing_profiles obp
      LEFT JOIN users u ON u.id = obp.owner_id
      LEFT JOIN water_bodies w ON w.owner_id = obp.owner_id
      WHERE obp.stripe_connected_account_id IS NOT NULL
         OR u.role = 'owner'
      GROUP BY obp.owner_id, u.full_name, u.email, obp.stripe_connected_account_id,
               obp.connect_onboarding_status, obp.charges_enabled, obp.payouts_enabled,
               obp.details_submitted, obp.updated_at
      ORDER BY obp.updated_at DESC NULLS LAST, u.full_name ASC
      LIMIT 25
    `
  );

  const row = paymentsQ.rows[0] || {};
  return {
    platform_commissions: Number(row.platform_commissions || 0),
    total_reservation_volume: Number(row.total_volume || 0),
    owner_earnings: Number(row.owner_earnings || 0),
    pending_checkout_volume: Number(row.pending_checkout_volume || 0),
    paid_payments_count: Number(row.paid_payments_count || 0),
    pending_payments_count: Number(row.pending_payments_count || 0),
    connected_owner_statuses: ownerStatusesQ.rows,
  };
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
  getOwnerRevenueSummary,
  getAdminRevenueSummary,
  isPremiumBilling,
  isOwnerProBilling,
  isOwnerConnectReady,
  roleHasPremiumAccess,
};
