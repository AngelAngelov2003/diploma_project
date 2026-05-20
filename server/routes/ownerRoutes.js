const express = require("express");
const authorize = require("../middleware/authorize");
const requireOwnerOrAdmin = require("../middleware/requireOwnerOrAdmin");
const { claimUpload, lakePhotoUpload } = require("../middleware/uploads");
const ownerController = require("../controllers/ownerController");

const router = express.Router();

router.get("/owner/lakes", authorize, requireOwnerOrAdmin, ownerController.getOwnerLakes);
router.get("/owner/my-claim-requests", authorize, ownerController.getMyClaimRequests);
router.post("/owner/claim-requests", authorize, claimUpload.single("proof_document"), ownerController.createClaimRequest);
router.patch("/owner/lakes/:waterBodyId", authorize, requireOwnerOrAdmin, ownerController.updateOwnerLake);
router.get("/owner/lakes/:waterBodyId/reservations", authorize, requireOwnerOrAdmin, ownerController.getOwnerLakeReservations);
router.get("/owner/lakes/:waterBodyId/earnings", authorize, requireOwnerOrAdmin, ownerController.getOwnerLakeEarnings);
router.get("/owner/lakes/:waterBodyId/spot-availability", authorize, requireOwnerOrAdmin, ownerController.getOwnerLakeSpotAvailability);
router.get("/owner/lakes/:waterBodyId/blocked-dates", authorize, requireOwnerOrAdmin, ownerController.getOwnerBlockedDates);
router.post("/owner/lakes/:waterBodyId/blocked-dates", authorize, requireOwnerOrAdmin, ownerController.createOwnerBlockedDate);
router.delete("/owner/lakes/:waterBodyId/blocked-dates/:blockedDateId", authorize, requireOwnerOrAdmin, ownerController.deleteOwnerBlockedDate);
router.get("/owner/lakes/:lakeId/spots", authorize, requireOwnerOrAdmin, ownerController.getLakeSpots);
router.post("/owner/lakes/:lakeId/spots/sync", authorize, requireOwnerOrAdmin, ownerController.syncLakeSpots);
router.patch("/owner/lakes/:lakeId/spots/:spotId", authorize, requireOwnerOrAdmin, ownerController.updateLakeSpot);
router.get("/owner/lakes/:waterBodyId/rooms", authorize, requireOwnerOrAdmin, ownerController.getLakeRooms);
router.post("/owner/lakes/:waterBodyId/rooms", authorize, requireOwnerOrAdmin, ownerController.createLakeRoom);
router.patch("/owner/lakes/:waterBodyId/rooms/:roomId", authorize, requireOwnerOrAdmin, ownerController.updateLakeRoom);
router.delete("/owner/lakes/:waterBodyId/rooms/:roomId", authorize, requireOwnerOrAdmin, ownerController.deleteLakeRoom);
router.get("/owner/lakes/:waterBodyId/photos", authorize, requireOwnerOrAdmin, ownerController.getLakePhotos);
router.post("/owner/lakes/:waterBodyId/photos", authorize, requireOwnerOrAdmin, lakePhotoUpload.array("images", 12), ownerController.uploadLakePhoto);
router.delete("/owner/lakes/:waterBodyId/photos/:photoId", authorize, requireOwnerOrAdmin, ownerController.deleteLakePhoto);
router.get("/owner/lakes/:waterBodyId/catches", authorize, requireOwnerOrAdmin, ownerController.getOwnerLakeCatches);
router.delete("/owner/lakes/:waterBodyId/catches/:catchId/photo", authorize, requireOwnerOrAdmin, ownerController.deleteOwnerCatchPhoto);
router.post("/owner/lakes/:waterBodyId/catches/:catchId/report", authorize, requireOwnerOrAdmin, ownerController.reportOwnerLakeCatch);

module.exports = router;
