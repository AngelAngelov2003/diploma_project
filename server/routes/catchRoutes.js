const express = require("express");
const authorize = require("../middleware/authorize");
const { upload } = require("../middleware/uploads");
const catchController = require("../controllers/catchController");

const router = express.Router();

router.post("/catch", authorize, upload.single("image"), catchController.createCatch);

router.get("/catches/my", authorize, catchController.getMyCatches);
router.get("/catches/my/analytics", authorize, catchController.getMyCatchAnalytics);
router.get("/catches/:catchId", authorize, catchController.getCatchById);
router.patch("/catches/:catchId", authorize, upload.single("image"), catchController.updateCatch);
router.delete("/catches/:catchId", authorize, catchController.deleteCatch);

module.exports = router;