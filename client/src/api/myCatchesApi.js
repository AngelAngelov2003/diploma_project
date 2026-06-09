import api from "./client";

export const getMyCatches = async () => {
  const { data } = await api.get("/catches/my");
  return data;
};

export const updateMyCatch = async (catchId, payload) => {
  const hasFile = Object.values(payload || {}).some((value) => typeof File !== "undefined" && value instanceof File);

  if (!hasFile) {
    const { data } = await api.patch(`/catches/${catchId}`, payload || {});
    return data;
  }

  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });

  const { data } = await api.patch(`/catches/${catchId}`, formData);
  return data;
};

export const deleteMyCatch = async (catchId) => {
  const { data } = await api.delete(`/catches/${catchId}`);
  return data;
};
