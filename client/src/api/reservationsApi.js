import api from "./client";

export const getMyReservations = async () => {
  const { data } = await api.get("/reservations/my");
  return data;
};

export const getIncomingReservations = async () => {
  const { data } = await api.get("/reservations/incoming");
  return data;
};

export const getReservationStatusForLake = async (lakeId) => {
  const { data } = await api.get(`/reservations/${lakeId}/my-status`);
  return data;
};

export const createReservation = async (payload) => {
  const { data } = await api.post("/reservations", payload);
  return data;
};

export const cancelReservation = async (reservationId) => {
  const { data } = await api.patch(`/reservations/${reservationId}/cancel`);
  return data;
};

export const updateReservationStatus = async (reservationId, status) => {
  const { data } = await api.patch(`/reservations/${reservationId}/status`, {
    status,
  });
  return data;
};
export const estimateReservation = async (payload) => {
  const { data } = await api.post("/reservations/estimate", payload);
  return data;
};
