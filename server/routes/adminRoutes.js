const express = require("express");
const authorize = require("../middleware/authorize");
const requireAdmin = require("../middleware/requireAdmin");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.get("/admin/analytics", authorize, requireAdmin, adminController.getAdminAnalytics);

router.get("/admin/users", authorize, requireAdmin, adminController.getUsers);
router.patch("/admin/users/:userId", authorize, requireAdmin, adminController.updateUser);
router.delete("/admin/users/:userId", authorize, requireAdmin, adminController.deleteUser);

router.get("/admin/water-bodies", authorize, requireAdmin, adminController.getWaterBodies);
router.patch(
  "/admin/water-bodies/:waterBodyId",
  authorize,
  requireAdmin,
  adminController.updateWaterBody
);
router.delete(
  "/admin/water-bodies/:waterBodyId",
  authorize,
  requireAdmin,
  adminController.deleteWaterBody
);

router.get("/admin/reviews", authorize, requireAdmin, adminController.getReviews);

router.get("/admin/user-reports", authorize, requireAdmin, adminController.getUserReports);
router.patch("/admin/user-reports/:reportId", authorize, requireAdmin, adminController.updateUserReport);
router.delete("/admin/user-reports/:reportId", authorize, requireAdmin, adminController.deleteUserReport);

router.get("/admin/catches", authorize, requireAdmin, adminController.getCatchLogs);
router.delete("/admin/catches/:catchId", authorize, requireAdmin, adminController.deleteCatchLog);
router.get("/admin/gallery-photos", authorize, requireAdmin, adminController.getGalleryPhotos);
router.delete("/admin/gallery-photos/:photoId", authorize, requireAdmin, adminController.deleteGalleryPhoto);
router.delete("/admin/reviews/:reviewId", authorize, requireAdmin, adminController.deleteReview);

router.get(
  "/admin/owner-claim-requests",
  authorize,
  requireAdmin,
  adminController.getOwnerClaimRequests
);

router.patch(
  "/admin/owner-claim-requests/:requestId",
  authorize,
  requireAdmin,
  adminController.updateOwnerClaimRequest
);

router.delete(
  "/admin/owner-claim-requests/:requestId",
  authorize,
  requireAdmin,
  adminController.deleteOwnerClaimRequest
);

module.exports = router;