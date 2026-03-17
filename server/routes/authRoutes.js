const express = require("express");
const authorize = require("../middleware/authorize");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.get("/auth/me", authorize, authController.me);

module.exports = router;