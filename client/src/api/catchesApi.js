import api from "./client";

export const getMyCatches = async () => {
  const { data } = await api.get("/catches/my");
  return data;
};

export const createCatch = async (formData) => {
  const { data } = await api.post("/catch", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};