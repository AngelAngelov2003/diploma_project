const express = require("express");
const authorize = require("../middleware/authorize");
const waterBodyController = require("../controllers/waterBodyController");

const router = express.Router();

router.get("/water-bodies", waterBodyController.getWaterBodies);
router.get("/water-bodies/in-bounds", waterBodyController.getWaterBodiesInBounds);
router.get("/forecast/:lat/:lng", waterBodyController.getForecastByLatLng);

router.get("/water-bodies/search", waterBodyController.searchWaterBodies);
router.get("/water-bodies/:waterBodyId", waterBodyController.getWaterBodyById);
router.get("/water-bodies/:waterBodyId/forecast", waterBodyController.getWaterBodyForecast);
router.get("/water-bodies/:waterBodyId/catches", waterBodyController.getWaterBodyCatches);
router.get("/water-bodies/:waterBodyId/species-summary", waterBodyController.getSpeciesSummary);
router.get("/water-bodies/:waterBodyId/photos", waterBodyController.getWaterBodyPhotos);
router.get("/water-bodies/:waterBodyId/booking-options", waterBodyController.getBookingOptions);

router.get("/water-bodies/:waterBodyId/reviews", waterBodyController.getReviews);
router.get("/water-bodies/:waterBodyId/reviews-summary", waterBodyController.getReviewsSummary);
router.post("/water-bodies/:waterBodyId/reviews", authorize, waterBodyController.upsertReview);
router.delete("/water-bodies/:waterBodyId/reviews/me", authorize, waterBodyController.deleteMyReview);

router.get("/water-bodies/:waterBodyId/blocked-dates", waterBodyController.getBlockedDates);

module.exports = router;