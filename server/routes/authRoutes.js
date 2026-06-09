const express = require("express");
const authorize = require("../middleware/authorize");
const authController = require("../controllers/authController");
const { createRateLimiter } = require("../middleware/rateLimit");

const router = express.Router();
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: "Твърде много опити за вход/регистрация. Моля, опитайте отново по-късно." });

router.post("/auth/register", authLimiter, authController.register);
router.post("/auth/login", authLimiter, authController.login);
router.post("/auth/forgot-password", authLimiter, authController.forgotPassword);
router.post("/auth/reset-password", authLimiter, authController.resetPassword);
router.get("/auth/verify-email", authController.verifyEmail);
router.get("/auth/me", authorize, authController.me);

module.exports = router;