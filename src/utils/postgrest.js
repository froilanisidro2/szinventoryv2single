import axios from 'axios';
import logger from './logger.js';
import { getFromCache, setInCache } from './cache.js';

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:8031';
const API_KEY = process.env.POSTGREST_API_KEY;

// Create axios instance
const apiClient = axios.create({
  baseURL: POSTGREST_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
    'Prefer': 'return=representation'
  }
});

/**
 * GET request with caching support
 */
export const getRequest = async (endpoint, params = {}, useCache = true, cacheTTL = null) => {
  try {
    const cacheKey = `postgrest:${endpoint}:${JSON.stringify(params)}`;

    if (useCache) {
      const cached = await getFromCache(cacheKey);
      if (cached) return cached;
    }

    logger.debug(`GET ${POSTGREST_URL}${endpoint}`, params);
    const response = await apiClient.get(endpoint, { params });

    if (useCache) {
      await setInCache(cacheKey, response.data, cacheTTL);
    }

    return response.data;
  } catch (error) {
    logger.error(`GET request failed for ${endpoint}:`, error.message);
    throw error;
  }
};

/**
 * POST request
 */
export const postRequest = async (endpoint, data) => {
  try {
    logger.debug(`POST ${POSTGREST_URL}${endpoint}`, data);
    const response = await apiClient.post(endpoint, data);
    return response.data;
  } catch (error) {
    logger.error(`POST request failed for ${endpoint}:`, error.message);
    throw error;
  }
};

/**
 * PATCH request
 */
export const patchRequest = async (endpoint, data) => {
  try {
    logger.debug(`PATCH ${POSTGREST_URL}${endpoint}`, data);
    const response = await apiClient.patch(endpoint, data);
    return response.data;
  } catch (error) {
    logger.error(`PATCH request failed for ${endpoint}:`, error.message);
    throw error;
  }
};

/**
 * DELETE request
 */
export const deleteRequest = async (endpoint) => {
  try {
    logger.debug(`DELETE ${POSTGREST_URL}${endpoint}`);
    const response = await apiClient.delete(endpoint);
    return response.data;
  } catch (error) {
    logger.error(`DELETE request failed for ${endpoint}:`, error.message);
    throw error;
  }
};

/**
 * Build query string for filtering, sorting, and pagination
 */
export const buildQueryString = (filters = {}, sort = null, limit = 20, offset = 0) => {
  const params = new URLSearchParams();

  // Add filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, value);
    }
  });

  // Add sorting
  if (sort) {
    params.append('order', sort);
  }

  // Add pagination
  params.append('limit', limit);
  params.append('offset', offset);

  return params.toString();
};

export default apiClient;
