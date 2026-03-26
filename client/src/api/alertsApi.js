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

export const updateAlert = async (id, payload) => {
  const { data } = await api.put(`/alerts/${id}`, payload);
  return data;
};

export const deleteAlert = async (id) => {
  const { data } = await api.delete(`/alerts/${id}`);
  return data;
};