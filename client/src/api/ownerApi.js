import api from "./client";

export const getOwnerLakes = async () => {
  const { data } = await api.get("/owner/lakes");
  return data;
};

export const claimLake = async (waterBodyId) => {
  const { data } = await api.post(`/owner/lakes/${waterBodyId}/claim`);
  return data;
};

export const updateOwnerLake = async (waterBodyId, payload) => {
  const { data } = await api.put(`/owner/lakes/${waterBodyId}`, payload);
  return data;
};

export const getBlockedDates = async (waterBodyId) => {
  const { data } = await api.get(`/owner/lakes/${waterBodyId}/blocked-dates`);
  return data;
};

export const addBlockedDate = async (waterBodyId, payload) => {
  const { data } = await api.post(
    `/owner/lakes/${waterBodyId}/blocked-dates`,
    payload
  );
  return data;
};

export const deleteBlockedDate = async (waterBodyId, blockedDateId) => {
  const { data } = await api.delete(
    `/owner/lakes/${waterBodyId}/blocked-dates/${blockedDateId}`
  );
  return data;
};