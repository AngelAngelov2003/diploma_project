import api from "./client";

export const getProfile = async () => {
  const { data } = await api.get("/profile");
  return data;
};

export const updateProfile = async (payload) => {
  const { data } = await api.patch("/profile", payload);
  return data;
};

export const updatePassword = async (payload) => {
  const { data } = await api.patch("/profile/password", payload);
  return data;
};

export const getNotificationPreferences = async () => {
  const { data } = await api.get("/profile/notification-preferences");
  return data;
};

export const updateNotificationPreferences = async (payload) => {
  const { data } = await api.patch("/profile/notification-preferences", payload);
  return data;
};