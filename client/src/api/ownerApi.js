import api from "./client";

export const getOwnerLakes = async () => {
  const { data } = await api.get("/owner/lakes");
  return data;
};

export const getClaimableLakes = async () => {
  const { data } = await api.get("/owner/claimable-lakes");
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
  const { data } = await api.delete(
    `/owner/lakes/${lakeId}/blocked-dates/${blockedDateId}`,
  );
  return data;
};