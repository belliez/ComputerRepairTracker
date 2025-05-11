/**
 * Utility functions for making API requests
 */

/**
 * Make a request to the API
 * @param method HTTP method
 * @param url URL path (will be appended to /api)
 * @param data Optional data to send with request
 * @returns Fetch response
 */
export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  data?: any
): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  // Ensure URL starts with /api
  const apiUrl = url.startsWith('/api') ? url : `/api${url}`;
  return fetch(apiUrl, options);
}

/**
 * Wrapper for GET requests
 * @param url URL path
 * @returns Fetch response
 */
export function get(url: string): Promise<Response> {
  return apiRequest('GET', url);
}

/**
 * Wrapper for POST requests
 * @param url URL path
 * @param data Data to send
 * @returns Fetch response
 */
export function post(url: string, data: any): Promise<Response> {
  return apiRequest('POST', url, data);
}

/**
 * Wrapper for PUT requests
 * @param url URL path
 * @param data Data to send
 * @returns Fetch response
 */
export function put(url: string, data: any): Promise<Response> {
  return apiRequest('PUT', url, data);
}

/**
 * Wrapper for DELETE requests
 * @param url URL path
 * @returns Fetch response
 */
export function del(url: string): Promise<Response> {
  return apiRequest('DELETE', url);
}