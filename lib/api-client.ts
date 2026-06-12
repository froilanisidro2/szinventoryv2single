'use server';

import { API_KEY } from './api-endpoints';

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, unknown> | Record<string, unknown>[];
  params?: Record<string, string | number | boolean>;
}

interface ApiResponse<T> {
  data: T;
  error: { message: string } | null;
}

/**
 * Generic API client for PostgREST endpoints
 */
export async function apiCall<T>(
  url: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const { method = 'GET', headers = {}, body, params } = options;

    // Build URL with query parameters
    let finalUrl = url;
    if (params) {
      const queryString = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryString.append(key, String(value));
      });
      finalUrl = `${url}?${queryString.toString()}`;
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
        // Request PostgREST to return the created/updated resource
        ...(method === 'POST' || method === 'PATCH' || method === 'PUT'
          ? { 'Prefer': 'return=representation' }
          : {}),
        ...headers,
      },
    };

    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(finalUrl, requestOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `API Error: ${response.status} ${response.statusText}`
      );
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return { data: [] as unknown as T, error: null };
    }

    const data = await response.json();
    // Return plain JSON - no serialization needed since API returns strings for dates
    return { data: data as T, error: null };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('API call failed:', {
      url: url,
      method: options.method || 'GET',
      error: err.message,
    });
    // Convert Error to plain object for serialization
    return { data: null as unknown as T, error: { message: err.message } };
  }
}

/**
 * GET request - Fetch data from an endpoint
 */
export async function apiGet<T>(
  url: string,
  params?: Record<string, string | number | boolean>
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, { method: 'GET', params });
}

export async function apiPost<T>(
  url: string,
  body: Record<string, unknown> | Record<string, unknown>[]
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, { method: 'POST', body });
}

/**
 * UPSERT request — INSERT or UPDATE on conflict.
 * Uses PostgREST's `on_conflict` + `Prefer: resolution=merge-duplicates`.
 * @param url      Base endpoint URL (no query string needed for conflict columns)
 * @param body     Row(s) to upsert
 * @param conflictCols  Comma-separated column names that form the unique key, e.g. "company_id,sku"
 */
export async function apiUpsert<T>(
  url: string,
  body: Record<string, unknown> | Record<string, unknown>[],
  conflictCols: string
): Promise<ApiResponse<T>> {
  const upsertUrl = `${url}?on_conflict=${conflictCols}`;
  return apiCall<T>(upsertUrl, {
    method: 'POST',
    body,
    headers: {
      'Prefer': 'return=representation,resolution=merge-duplicates',
    },
  });
}

/**
 * PATCH request - Update resource
 */
export async function apiPatch<T>(
  url: string,
  body: Record<string, unknown>
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, { method: 'PATCH', body });
}

/**
 * PUT request - Replace resource
 */
export async function apiPut<T>(
  url: string,
  body: Record<string, unknown>
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, { method: 'PUT', body });
}

/**
 * DELETE request - Delete resource
 */
export async function apiDelete<T>(
  url: string
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, { method: 'DELETE' });
}
