import api from "./client";

export const getOwnerLakes = async () => {
  const { data } = await api.get("/owner/lakes");
  return data;
};

export const getMyClaimRequests = async () => {
  const { data } = await api.get("/owner/my-claim-requests");
  return data;
};

export const submitClaimRequest = async (formData) => {
  const { data } = await api.post("/owner/claim-requests", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const updateOwnerLake = async (lakeId, payload) => {
  const { data } = await api.patch(`/owner/lakes/${lakeId}`, payload);
  return data;
};

export const getBlockedDates = async (lakeId) => {
  const { data } = await api.get(`/owner/lakes/${lakeId}/blocked-dates`);
  return data;
};

export const addBlockedDate = async (lakeId, payload) => {
  const { data } = await api.post(`/owner/lakes/${lakeId}/blocked-dates`, payload);
  return data;
};

export const deleteBlockedDate = async (lakeId, blockedDateId) => {
  const { data } = await api.delete(`/owner/lakes/${lakeId}/blocked-dates/${blockedDateId}`);
  return data;
};

export const getLakeSpots = async (lakeId) => {
  const { data } = await api.get(`/owner/lakes/${lakeId}/spots`);
  return data;
};

export const syncLakeSpots = async (lakeId, spots_count) => {
  const { data } = await api.post(`/owner/lakes/${lakeId}/spots/sync`, {
    spots_count,
  });
  return data;
};

export const updateLakeSpot = async (lakeId, spotId, payload) => {
  const { data } = await api.patch(`/owner/lakes/${lakeId}/spots/${spotId}`, payload);
  return data;
};

export const getLakeRooms = async (lakeId) => {
  const { data } = await api.get(`/owner/lakes/${lakeId}/rooms`);
  return data;
};

export const createLakeRoom = async (lakeId, payload) => {
  const { data } = await api.post(`/owner/lakes/${lakeId}/rooms`, payload);
  return data;
};

export const updateLakeRoom = async (lakeId, roomId, payload) => {
  const { data } = await api.patch(`/owner/lakes/${lakeId}/rooms/${roomId}`, payload);
  return data;
};

export const deleteLakeRoom = async (lakeId, roomId) => {
  const { data } = await api.delete(`/owner/lakes/${lakeId}/rooms/${roomId}`);
  return data;
};

export const getLakePhotos = async (lakeId) => {
  const { data } = await api.get(`/owner/lakes/${lakeId}/photos`);
  return data;
};

export const uploadLakePhoto = async (lakeId, formData) => {
  const { data } = await api.post(`/owner/lakes/${lakeId}/photos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const deleteLakePhoto = async (lakeId, photoId) => {
  const { data } = await api.delete(`/owner/lakes/${lakeId}/photos/${photoId}`);
  return data;
};
