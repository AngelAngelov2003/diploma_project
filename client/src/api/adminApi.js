import api from "./client";

export const getAdminDashboard = async () => {
  const { data } = await api.get("/admin/dashboard");
  return data;
};

export const getAdminWaterBodies = async () => {
  const { data } = await api.get("/admin/water-bodies");
  return data;
};

export const getAdminUsers = async () => {
  const { data } = await api.get("/admin/users");
  return data;
};

export const updateUserStatus = async (userId, payload) => {
  const { data } = await api.put(`/admin/users/${userId}`, payload);
  return data;
};

export const deleteWaterBody = async (waterBodyId) => {
  const { data } = await api.delete(`/admin/water-bodies/${waterBodyId}`);
  return data;
};