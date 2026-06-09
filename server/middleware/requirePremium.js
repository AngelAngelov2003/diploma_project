const billingService = require("../services/billingService");

const requirePremium = async (req, res, next) => {
  try {
    const state = await billingService.getUserPremiumState(req.user, req.userRole);

    if (!state.has_premium_access) {
      return res.status(402).json({
        error: "За тази функция е нужен Premium абонамент.",
        code: "PREMIUM_REQUIRED",
      });
    }

    req.billing = state;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = requirePremium;
