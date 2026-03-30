const express = require("express");
const authorize = require("../middleware/authorize");
const requireOwnerOrAdmin = require("../middleware/requireOwnerOrAdmin");
const { claimUpload } = require("../middleware/uploads");
const ownerController = require("../controllers/ownerController");

const router = express.Router();

router.get("/owner/lakes", authorize, requireOwnerOrAdmin, ownerController.getOwnerLakes);
router.get(
  "/owner/my-claim-requests",
  authorize,
  ownerController.getMyClaimRequests
);

router.post(
  "/owner/claim-requests",
  authorize,
  claimUpload.single("proof_document"),
  ownerController.createClaimRequest
);

router.patch(
  "/owner/lakes/:waterBodyId",
  authorize,
  requireOwnerOrAdmin,
  ownerController.updateOwnerLake
);

router.get(
  "/owner/lakes/:waterBodyId/blocked-dates",
  authorize,
  requireOwnerOrAdmin,
  ownerController.getOwnerBlockedDates
);

router.post(
  "/owner/lakes/:waterBodyId/blocked-dates",
  authorize,
  requireOwnerOrAdmin,
  ownerController.createOwnerBlockedDate
);

router.delete(
  "/owner/lakes/:waterBodyId/blocked-dates/:blockedDateId",
  authorize,
  requireOwnerOrAdmin,
  ownerController.deleteOwnerBlockedDate
);

module.exports = router;