import api from "./client";

export const getAdminAnalytics = async () => {
  const { data } = await api.get("/admin/analytics");
  return data;
};

export const getAdminWaterBodies = async () => {
  const { data } = await api.get("/admin/water-bodies");
  return data;
};

export const updateAdminWaterBody = async (lakeId, payload) => {
  const { data } = await api.patch(`/admin/water-bodies/${lakeId}`, payload);
  return data;
};

export const deleteAdminWaterBody = async (lakeId) => {
  const { data } = await api.delete(`/admin/water-bodies/${lakeId}`);
  return data;
};

export const getAdminUsers = async () => {
  const { data } = await api.get("/admin/users");
  return data;
};

export const updateAdminUser = async (userId, payload) => {
  const { data } = await api.patch(`/admin/users/${userId}`, payload);
  return data;
};

export const deleteAdminUser = async (userId) => {
  const { data } = await api.delete(`/admin/users/${userId}`);
  return data;
};

export const getAdminReviews = async () => {
  const { data } = await api.get("/admin/reviews");
  return data;
};

export const deleteAdminReview = async (reviewId) => {
  const { data } = await api.delete(`/admin/reviews/${reviewId}`);
  return data;
};

export const getAdminOwnerClaimRequests = async () => {
  const { data } = await api.get("/admin/owner-claim-requests");
  return data;
};

export const updateAdminOwnerClaimRequest = async (requestId, payload) => {
  const { data } = await api.patch(
    `/admin/owner-claim-requests/${requestId}`,
    payload,
  );
  return data;
};

export const deleteAdminOwnerClaimRequest = async (requestId) => {
  const { data } = await api.delete(`/admin/owner-claim-requests/${requestId}`);
  return data;
};

export const getAdminCatchLogs = async () => {
  const { data } = await api.get("/admin/catches");
  return data;
};

export const deleteAdminCatchLog = async (catchId) => {
  const { data } = await api.delete(`/admin/catches/${catchId}`);
  return data;
};

export const getAdminGalleryPhotos = async () => {
  const { data } = await api.get("/admin/gallery-photos");
  return data;
};

export const deleteAdminGalleryPhoto = async (photoId) => {
  const { data } = await api.delete(`/admin/gallery-photos/${photoId}`);
  return data;
};

export const getAdminUserReports = async () => {
  const { data } = await api.get("/admin/user-reports");
  return data;
};

export const updateAdminUserReport = async (reportId, payload) => {
  const { data } = await api.patch(`/admin/user-reports/${reportId}`, payload);
  return data;
};

export const deleteAdminUserReport = async (reportId) => {
  const { data } = await api.delete(`/admin/user-reports/${reportId}`);
  return data;
};
