const billingService = require("../services/billingService");
const { requireStripe, toStripeTimestampDate } = require("../services/stripeService");

const getCurrentPeriodEnd = (subscription) =>
  toStripeTimestampDate(subscription?.current_period_end || subscription?.items?.data?.[0]?.current_period_end);

const getCustomerId = (subscription) =>
  typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

const getBillingType = (object) =>
  object?.metadata?.billing_type || object?.metadata?.plan || "";

const handleSubscription = async (subscription) => {
  const customerId = getCustomerId(subscription);
  if (!customerId) return;

  const billingType = getBillingType(subscription);
  const currentPeriodEnd = getCurrentPeriodEnd(subscription);

  if (billingType === "owner_pro") {
    await billingService.updateOwnerSubscriptionByCustomer({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      plan: "pro",
      currentPeriodEnd,
    });
    return;
  }

  await billingService.updateSubscriptionByCustomer({
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    tier: "premium",
    currentPeriodEnd,
  });
};

const handleCheckoutCompleted = async (session, stripe) => {
  const billingType = getBillingType(session);

  if (session.mode === "payment" && billingType === "reservation_payment") {
    await billingService.markReservationPaymentPaid({
      checkoutSessionId: session.id,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
      reservationId: session.metadata?.reservation_id || null,
    });
    return;
  }

  if (session.mode !== "subscription" || !session.subscription) return;
  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  await handleSubscription(subscription);
};

const handleCheckoutExpired = async (session) => {
  if (session.mode !== "payment" || getBillingType(session) !== "reservation_payment") return;
  await billingService.markReservationPaymentFailed({
    checkoutSessionId: session.id,
    reservationId: session.metadata?.reservation_id || null,
  });
};

const stripeWebhook = async (req, res) => {
  let event;

  try {
    const stripe = requireStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      const missingSecretError = new Error("STRIPE_WEBHOOK_SECRET is not configured. Webhook rejected for safety.");
      missingSecretError.status = 500;
      throw missingSecretError;
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing Stripe signature" });
    }

    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

    await billingService.recordStripeWebhookEvent(event);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, stripe);
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscription(event.data.object);
        break;
      case "account.updated":
        await billingService.updateOwnerConnectStatusByAccountId(event.data.object);
        break;
      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error("stripeWebhook error:", err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
};

module.exports = { stripeWebhook };
