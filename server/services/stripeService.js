const Stripe = require("stripe");

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? Stripe(stripeSecretKey) : null;

const requireStripe = () => {
  if (!stripe) {
    const err = new Error("Stripe не е конфигуриран. Добавете STRIPE_SECRET_KEY в server/.env.");
    err.status = 500;
    throw err;
  }
  return stripe;
};

const getAppUrl = () => process.env.CLIENT_URL || process.env.APP_URL || "http://localhost:3000";

const toStripeTimestampDate = (timestamp) => {
  if (!timestamp) return null;
  return new Date(Number(timestamp) * 1000);
};

module.exports = {
  requireStripe,
  getAppUrl,
  toStripeTimestampDate,
};
