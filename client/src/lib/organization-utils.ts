/**
 * Organization Utilities
 * Helper functions for managing organization context throughout the application
 */

import { useCallback } from 'react';

/**
 * Helper function to get the current organization ID from various sources
 * Prioritizes: 
 * 1. Currently selected organization in state
 * 2. Organization ID stored in localStorage
 * 3. Default fallback (3)
 */
export function getCurrentOrgId(organization?: { id: number } | null): number {
  return organization?.id || 
         Number(localStorage.getItem('currentOrganizationId')) || 
         3; // Default fallback if no organization context is found
}

/**
 * Helper function to generate standardized request headers with organization context
 * @param authToken Optional authentication token to include in headers
 * @param organization Optional organization object with ID
 */
export function getStandardHeaders(
  authToken?: string | null,
  organization?: { id: number } | null
): Record<string, string> {
  const orgId = getCurrentOrgId(organization);
  
  const headers: Record<string, string> = {
    'X-Debug-Client': 'RepairTrackerClient',
    'X-Organization-ID': orgId.toString(),
    'Content-Type': 'application/json',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache'
  };
  
  // Add authorization header if token exists
  if (authToken) {
    // Check if the token already includes the Bearer prefix
    if (authToken.startsWith('Bearer ')) {
      headers['Authorization'] = authToken;
    } else {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
  }
  
  return headers;
}

/**
 * React hook version of getStandardHeaders for use in components
 */
export function useStandardHeaders() {
  return useCallback((authToken?: string | null, organization?: { id: number } | null) => {
    return getStandardHeaders(authToken, organization);
  }, []);
}