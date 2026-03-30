const express = require("express");
const authorize = require("../middleware/authorize");
const devOnly = require("../middleware/devOnly");
const devController = require("../controllers/devController");

const router = express.Router();

router.get("/ml/training-data", devController.getMlTrainingData);
router.post("/dev/run-alerts-now", authorize, devOnly, devController.runAlertsNow);
router.get("/dev/run-alerts-now", authorize, devOnly, devController.runAlertsNow);

module.exports = router;