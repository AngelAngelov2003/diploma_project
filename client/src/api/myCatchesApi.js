import api from "./client";

export const getMyCatches = async () => {
  const { data } = await api.get("/catches/my");
  return data;
};