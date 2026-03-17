const express = require("express");
const authorize = require("../middleware/authorize");
const profileController = require("../controllers/profileController");

const router = express.Router();

router.get("/profile", authorize, profileController.getProfile);
router.patch("/profile", authorize, profileController.updateProfile);
router.patch("/profile/password", authorize, profileController.changePassword);

router.get(
  "/profile/notification-preferences",
  authorize,
  profileController.getNotificationPreferences
);

router.patch(
  "/profile/notification-preferences",
  authorize,
  profileController.updateNotificationPreferences
);

module.exports = router;