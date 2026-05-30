const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const devRoutes = require("./routes/devRoutes");
const profileRoutes = require("./routes/profileRoutes");
const catchRoutes = require("./routes/catchRoutes");
const alertRoutes = require("./routes/alertRoutes");
const waterBodyRoutes = require("./routes/waterBodyRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const ownerRoutes = require("./routes/ownerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const billingRoutes = require("./routes/billingRoutes");
const { stripeWebhook } = require("./controllers/stripeWebhookController");

const {
  ensureAlertJobRunsTable,
  ensureUserNotificationPreferencesTable,
  ensureLakeOwnerClaimRequestsTable,
  ensureSubscriptionDeliveriesTable,
  ensureReservationDomainTables,
  ensureBillingTables,
  ensurePasswordResetTokensTable,
} = require("./setup/ensureTables");

const {
  startDailyCron,
  startWeeklyCron,
  runStartupCatchUp,
} = require("./services/alertService");

const securityHeaders = require("./middleware/securityHeaders");
const { createRateLimiter } = require("./middleware/rateLimit");

const app = express();
const PORT = Number(process.env.PORT || 5000);

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(createRateLimiter({ windowMs: 60_000, max: 180 }));
app.post("/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({ ok: true, message: "Server is running" });
});

app.use(authRoutes);
app.use(profileRoutes);
app.use(devRoutes);
app.use(catchRoutes);
app.use(alertRoutes);
app.use(waterBodyRoutes);
app.use(reservationRoutes);
app.use(ownerRoutes);
app.use(adminRoutes);
app.use(billingRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  const isUploadError = err?.name === "MulterError" || String(err?.message || "").includes("uploads are allowed") || String(err?.message || "").includes("Owner proof");
  const status = err.status || (isUploadError ? 400 : 500);

  console.error(err);
  res.status(status).json({
    error: err.message || "Internal server error",
  });
});

const startServer = async () => {
  await ensureAlertJobRunsTable();
  await ensureUserNotificationPreferencesTable();
  await ensureLakeOwnerClaimRequestsTable();
  await ensureSubscriptionDeliveriesTable();
  await ensureReservationDomainTables();
  await ensureBillingTables();
  await ensurePasswordResetTokensTable();

  startDailyCron();
  startWeeklyCron();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    setTimeout(() => {
      runStartupCatchUp().catch((err) => {
        console.error("Startup catch-up failed:", err);
      });
    }, 10000);
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});