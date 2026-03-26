import api from "./client";

export const getWaterBodies = async () => {
  const { data } = await api.get("/water-bodies");
  return data;
};

export const getWaterBodiesInBounds = async (params) => {
  const { data } = await api.get("/water-bodies/in-bounds", { params });
  return data;
};

export const searchWaterBodies = async (q) => {
  const { data } = await api.get("/water-bodies/search", {
    params: { q },
  });
  return data;
};

export const getWaterBodyById = async (id) => {
  const { data } = await api.get(`/water-bodies/${id}`);
  return data;
};

export const getForecastByCoordinates = async (lat, lng) => {
  const { data } = await api.get(`/forecast/${lat}/${lng}`);
  return data;
};