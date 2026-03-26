import api from "./client";

export const getMyAlerts = async () => {
  const { data } = await api.get("/alerts/my");
  return data;
};

export const getAlertStatus = async (waterBodyId) => {
  const { data } = await api.get(`/alerts/status/${waterBodyId}`);
  return data;
};

export const createAlert = async (payload) => {
  const { data } = await api.post("/alerts", payload);
  return data;
};

export const updateAlert = async (waterBodyId, payload) => {
  const { data } = await api.patch(`/alerts/${waterBodyId}`, payload);
  return data;
};

export const deleteAlert = async (waterBodyId) => {
  const { data } = await api.delete(`/alerts/${waterBodyId}`);
  return data;
};