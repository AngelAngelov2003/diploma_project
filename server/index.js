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

const {
  ensureAlertJobRunsTable,
  ensureUserNotificationPreferencesTable,
  ensureLakeOwnerClaimRequestsTable,
  ensureSubscriptionDeliveriesTable,
  ensureReservationDomainTables,
} = require("./setup/ensureTables");

const {
  startDailyCron,
  startWeeklyCron,
  runStartupCatchUp,
} = require("./services/alertService");

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

const startServer = async () => {
  await ensureAlertJobRunsTable();
  await ensureUserNotificationPreferencesTable();
  await ensureLakeOwnerClaimRequestsTable();
  await ensureSubscriptionDeliveriesTable();
  await ensureReservationDomainTables();

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