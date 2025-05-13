/**
 * Auth utilities for working with Firebase authentication
 */

/**
 * Get the current authentication token from localStorage or cookie
 * @returns string | null The authentication token or null if not found
 */
export function getAuthToken(): string | null {
  // Try to get the token from localStorage
  const token = localStorage.getItem('authToken');
  if (token) {
    return token;
  }
  
  // Try to get token from cookie as fallback
  const authCookie = document.cookie.split(';').find(cookie => cookie.trim().startsWith('authToken='));
  if (authCookie) {
    return authCookie.split('=')[1];
  }
  
  return null;
}

/**
 * Get the current organization ID from localStorage
 * @returns number | null The organization ID or null if not found
 */
export function getOrganizationId(): number | null {
  const organizationId = localStorage.getItem('organizationId');
  return organizationId ? parseInt(organizationId, 10) : null;
}