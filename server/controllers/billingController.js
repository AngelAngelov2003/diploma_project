const pool = require("../db");
const billingService = require("../services/billingService");
const { requireStripe, getAppUrl } = require("../services/stripeService");

const isOwnerOrAdmin = (role) => ["owner", "admin"].includes(String(role || "user").toLowerCase());

const requireOwnerRole = (req, res) => {
  if (!isOwnerOrAdmin(req.userRole)) {
    res.status(403).json({ error: "Only approved owners can access owner billing." });
    return false;
  }
  return true;
};

const getCurrentUser = async (userId) => {
  const userQ = await pool.query(
    `SELECT id, email, full_name, role FROM users WHERE id = $1`,
    [userId]
  );
  return userQ.rows[0] || null;
};

const getBillingStatus = async (req, res, next) => {
  try {
    const state = await billingService.getUserPremiumState(req.user, req.userRole);
    res.json(state);
  } catch (err) {
    next(err);
  }
};

const getOwnerBillingStatus = async (req, res, next) => {
  try {
    if (!requireOwnerRole(req, res)) return;
    const state = await billingService.getOwnerBillingState(req.user, req.userRole);
    res.json(state);
  } catch (err) {
    next(err);
  }
};


const getOwnerRevenueSummary = async (req, res, next) => {
  try {
    if (!requireOwnerRole(req, res)) return;
    const stripe = requireStripe();
    const state = await billingService.getOwnerRevenueSummary(req.user, stripe);
    res.json(state);
  } catch (err) {
    next(err);
  }
};

const createPremiumCheckoutSession = async (req, res, next) => {
  try {
    const priceId = process.env.STRIPE_USER_PREMIUM_PRICE_ID;
    if (!priceId) {
      return res.status(500).json({ error: "Missing STRIPE_USER_PREMIUM_PRICE_ID in server/.env" });
    }

    const stripe = requireStripe();
    const billing = await billingService.getOrCreateUserBillingProfile(req.user);
    const user = await getCurrentUser(req.user);

    let customerId = billing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || undefined,
        metadata: { user_id: String(req.user), billing_type: "user_premium" },
      });
      customerId = customer.id;
      await billingService.setStripeCustomerId(req.user, customerId);
    }

    const appUrl = getAppUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?checkout=success`,
      cancel_url: `${appUrl}/billing?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { user_id: String(req.user), billing_type: "user_premium", plan: "user_premium" },
      },
      metadata: { user_id: String(req.user), billing_type: "user_premium", plan: "user_premium" },
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
};

const createCustomerPortalSession = async (req, res, next) => {
  try {
    const stripe = requireStripe();
    const billing = await billingService.getOrCreateUserBillingProfile(req.user);

    if (!billing?.stripe_customer_id) {
      return res.status(400).json({ error: "No Stripe customer exists for this account yet." });
    }

    const appUrl = getAppUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
};

const createOwnerConnectOnboardingLink = async (req, res, next) => {
  try {
    if (!requireOwnerRole(req, res)) return;
    const stripe = requireStripe();
    const billing = await billingService.getOrCreateOwnerBillingProfile(req.user);

    const user = await getCurrentUser(req.user);

    let accountId = billing?.stripe_connected_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: process.env.STRIPE_CONNECT_COUNTRY || "BG",
        email: user.email,
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { owner_id: String(req.user) },
      });
      accountId = account.id;
      await billingService.setOwnerConnectedAccount(req.user, account);
    }

    const appUrl = getAppUrl();
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/owner?connect=refresh`,
      return_url: `${appUrl}/owner?connect=return`,
      type: "account_onboarding",
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    next(err);
  }
};

const refreshOwnerConnectStatus = async (req, res, next) => {
  try {
    if (!requireOwnerRole(req, res)) return;
    const stripe = requireStripe();
    const billing = await billingService.getOrCreateOwnerBillingProfile(req.user);

    if (!billing?.stripe_connected_account_id) {
      return res.json(await billingService.getOwnerBillingState(req.user, req.userRole));
    }

    const account = await stripe.accounts.retrieve(billing.stripe_connected_account_id);
    await billingService.setOwnerConnectedAccount(req.user, account);
    const state = await billingService.getOwnerBillingState(req.user, req.userRole);
    res.json(state);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBillingStatus,
  getOwnerBillingStatus,
  getOwnerRevenueSummary,
  createPremiumCheckoutSession,
  createCustomerPortalSession,
  createOwnerConnectOnboardingLink,
  refreshOwnerConnectStatus,
};
