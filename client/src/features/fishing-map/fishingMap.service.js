import {
  getWaterBodiesInBounds,
  searchWaterBodies,
  getWaterBodyById,
} from "../../api/waterBodiesApi";

export const fetchWaterBodiesInBounds = async (params) => {
  return getWaterBodiesInBounds(params);
};

export const fetchSearchResults = async (query) => {
  if (!query?.trim()) {
    return [];
  }

  return searchWaterBodies(query.trim());
};

export const fetchWaterBodyById = async (id) => {
  return getWaterBodyById(id);
};