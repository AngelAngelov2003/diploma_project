const express = require("express");
const authorize = require("../middleware/authorize");
const billingController = require("../controllers/billingController");

const router = express.Router();

router.get("/billing/status", authorize, billingController.getBillingStatus);
router.post("/billing/checkout/premium", authorize, billingController.createPremiumCheckoutSession);
router.post("/billing/portal", authorize, billingController.createCustomerPortalSession);

router.get("/billing/owner/status", authorize, billingController.getOwnerBillingStatus);
router.get("/billing/owner/revenue", authorize, billingController.getOwnerRevenueSummary);
router.post("/billing/owner/connect/onboarding", authorize, billingController.createOwnerConnectOnboardingLink);
router.post("/billing/owner/connect/refresh", authorize, billingController.refreshOwnerConnectStatus);
router.post("/billing/owner/connect/login-link", authorize, billingController.createOwnerConnectLoginLink);
router.patch("/billing/owner/online-payments", authorize, billingController.updateOwnerOnlinePayments);

module.exports = router;
