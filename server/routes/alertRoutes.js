const express = require("express");
const authorize = require("../middleware/authorize");
const alertController = require("../controllers/alertController");
const requirePremium = require("../middleware/requirePremium");

const router = express.Router();

router.get("/alerts/my", authorize, alertController.getAlerts);
router.get("/alerts/status/:waterBodyId", authorize, alertController.getAlertStatus);
router.post("/alerts", authorize, requirePremium, alertController.createAlert);
router.patch("/alerts/:waterBodyId", authorize, requirePremium, alertController.updateAlert);
router.delete("/alerts/:waterBodyId", authorize, alertController.deleteAlert);

router.get("/favorites/my", authorize, alertController.getFavorites);
router.post("/favorites", authorize, alertController.createFavorite);
router.delete("/favorites/:waterBodyId", authorize, alertController.deleteFavorite);

module.exports = router;