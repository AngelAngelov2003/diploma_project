import api from "./client";

export const getWaterBodyById = async (id) => {
  const { data } = await api.get(`/water-bodies/${id}`);
  return data;
};

export const getWaterBodyForecast = async (id) => {
  const { data } = await api.get(`/water-bodies/${id}/forecast`);
  return data;
};

export const getWaterBodyCatches = async (id) => {
  const { data } = await api.get(`/water-bodies/${id}/catches`);
  return data;
};

export const getWaterBodySpeciesSummary = async (id) => {
  const { data } = await api.get(`/water-bodies/${id}/species-summary`);
  return data;
};

export const getWaterBodyPhotos = async (id) => {
  const { data } = await api.get(`/water-bodies/${id}/photos`);
  return data;
};

export const getWaterBodyReviews = async (id) => {
  const { data } = await api.get(`/water-bodies/${id}/reviews`);
  return data;
};

export const getWaterBodyReviewsSummary = async (id) => {
  const { data } = await api.get(`/water-bodies/${id}/reviews-summary`);
  return data;
};

export const createWaterBodyReview = async (id, payload) => {
  const { data } = await api.post(`/water-bodies/${id}/reviews`, payload);
  return data;
};

export const deleteMyWaterBodyReview = async (id) => {
  const { data } = await api.delete(`/water-bodies/${id}/reviews/me`);
  return data;
};

export const getWaterBodyBlockedDates = async (id) => {
  const { data } = await api.get(`/water-bodies/${id}/blocked-dates`);
  return data;
};
export const getWaterBodyBookingOptions = async (id) => {
  const { data } = await api.get(`/water-bodies/${id}/booking-options`);
  return data;
};

export const getWaterBodyAvailability = async (id, params) => {
  const { data } = await api.get(`/water-bodies/${id}/availability`, { params });
  return data;
};
