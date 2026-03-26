import api from "./client";

export const getReservations = async () => {
  const { data } = await api.get("/reservations");
  return data;
};

export const createReservation = async (payload) => {
  const { data } = await api.post("/reservations", payload);
  return data;
};

export const cancelReservation = async (id) => {
  const { data } = await api.delete(`/reservations/${id}`);
  return data;
};