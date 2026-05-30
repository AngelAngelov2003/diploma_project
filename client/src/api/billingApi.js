import api from "./client";

export const getBillingStatus = async () => {
  const { data } = await api.get("/billing/status");
  return data;
};

export const startPremiumCheckout = async () => {
  const { data } = await api.post("/billing/checkout/premium");
  return data;
};

export const openBillingPortal = async () => {
  const { data } = await api.post("/billing/portal");
  return data;
};

export const getOwnerBillingStatus = async () => {
  const { data } = await api.get("/billing/owner/status");
  return data;
};

export const startOwnerConnectOnboarding = async () => {
  const { data } = await api.post("/billing/owner/connect/onboarding");
  return data;
};

export const refreshOwnerConnectStatus = async () => {
  const { data } = await api.post("/billing/owner/connect/refresh");
  return data;
};


export const getOwnerRevenueSummary = async () => {
  const { data } = await api.get("/billing/owner/revenue");
  return data;
};
