const express = require("express");
const authorize = require("../middleware/authorize");
const reservationController = require("../controllers/reservationController");

const router = express.Router();

router.get("/reservations/my", authorize, reservationController.getMyReservations);
router.get("/reservations/incoming", authorize, reservationController.getIncomingReservations);
router.get("/reservations/:waterBodyId/my-status", authorize, reservationController.getMyReservationStatus);
router.post("/reservations/estimate", authorize, reservationController.estimateReservation);
router.post("/reservations", authorize, reservationController.createReservation);
router.patch("/reservations/:reservationId/cancel", authorize, reservationController.cancelReservation);
router.patch("/reservations/:reservationId/status", authorize, reservationController.updateReservationStatus);

module.exports = router;
