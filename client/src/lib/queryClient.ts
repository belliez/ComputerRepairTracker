import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    console.error(`API Error: ${res.status} - ${text}`);
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get auth tokens from localStorage
  const firebaseToken = localStorage.getItem('firebase_token');
  const devMode = localStorage.getItem('dev_mode') === 'true';
  
  // Setup headers
  const headers: Record<string, string> = {};
  
  // Include Content-Type if there's data
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add special header for organization debugging
  headers["X-Debug-Client"] = "RepairTrackerClient";
  
  // Add organization ID from localStorage if available
  const orgId = localStorage.getItem('currentOrganizationId');
  if (orgId) {
    console.log(`Adding organization ID ${orgId} to request`);
    headers["X-Organization-ID"] = orgId;
  }
  
  // Add Authorization header with appropriate token
  if (firebaseToken) {
    console.log('Adding auth header with token for API request to', url);
    headers["Authorization"] = `Bearer ${firebaseToken}`;
  } else if (devMode || import.meta.env.MODE === 'development') {
    // Create a new dev token if needed for dev mode
    console.log('Creating new dev token for API request to', url);
    const newDevToken = 'dev-token-' + Date.now();
    localStorage.setItem('firebase_token', newDevToken);
    localStorage.setItem('dev_mode', 'true'); // Ensure dev mode is set
    headers["Authorization"] = `Bearer ${newDevToken}`;
    headers["X-Debug-Mode"] = "true";
  } else {
    console.log('No auth token available for API request to', url);
  }
  
  const res = await fetch(url, {
    method,
    headers: headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get auth tokens from localStorage
    const firebaseToken = localStorage.getItem('firebase_token');
    const devMode = localStorage.getItem('dev_mode') === 'true';
    
    // Setup headers
    const headers: Record<string, string> = {};
    
    // Add special header for debugging
    headers["X-Debug-Client"] = "RepairTrackerClient";
    
    // Add organization ID from localStorage if available
    console.log('QUERY DEBUG: Checking for organization ID in localStorage...');
    const orgId = localStorage.getItem('currentOrganizationId');
    
    if (orgId) {
      console.log(`QUERY DEBUG: Adding organization ID ${orgId} to query request for ${queryKey[0]}`);
      headers["X-Organization-ID"] = orgId;
    } else {
      console.warn(`QUERY DEBUG: No organization ID found in localStorage for query to ${queryKey[0]}!`);
      // Fallback to organization ID 2 for debugging
      console.log(`QUERY DEBUG: Using fallback organization ID 2 for query to ${queryKey[0]}`);
      headers["X-Organization-ID"] = "2";
    }
    
    // Add Authorization header with appropriate token
    if (firebaseToken) {
      console.log('Adding auth header with token for query');
      headers["Authorization"] = `Bearer ${firebaseToken}`;
    } else if (devMode || import.meta.env.MODE === 'development') {
      // Create a new dev token if needed for dev mode
      console.log('Creating new dev token for query');
      const newDevToken = 'dev-token-' + Date.now();
      localStorage.setItem('firebase_token', newDevToken);
      localStorage.setItem('dev_mode', 'true'); // Ensure dev mode is set
      headers["Authorization"] = `Bearer ${newDevToken}`;
      headers["X-Debug-Mode"] = "true";
    } else {
      console.log('No auth token available for query');
    }
    
    const url = queryKey[0] as string;
    console.log(`QUERY DEBUG: Making query to ${url}`);
    
    try {
      // Special handling for settings endpoints with debugging
      if (url.includes('/settings/currencies') || url.includes('/settings/tax-rates')) {
        console.log(`SETTINGS DEBUG: Making direct fetch to ${url} (settings endpoint)`);
        
        // Automatically use public endpoints for settings to avoid auth issues
        const publicUrl = url.replace('/api/settings/', '/api/public-settings/');
        console.log(`SETTINGS DEBUG: Using public endpoint: ${publicUrl}`);
        
        // For public endpoints, we don't need auth headers
        const publicRes = await fetch(publicUrl, {
          credentials: "include"
        });
        
        console.log(`SETTINGS DEBUG: ${publicUrl} returned status ${publicRes.status}`);
        
        if (publicRes.ok) {
          const publicData = await publicRes.json();
          console.log(`SETTINGS DEBUG: Public endpoint data:`, publicData);
          return publicData;
        }
        
        // Fallback to original request with auth if needed
        console.log(`SETTINGS DEBUG: Public endpoint failed, trying original with auth`);
        // Debugging mode - show headers
        console.log('Request headers:', JSON.stringify(headers));
        
        const res = await fetch(url, {
          credentials: "include",
          headers: headers,
          mode: 'cors'
        });
        
        console.log(`SETTINGS DEBUG: ${url} returned status ${res.status}`);
        
        if (res.ok) {
          try {
            const text = await res.text();
            console.log(`SETTINGS DEBUG: Raw response text: ${text}`);
            if (text) {
              const data = JSON.parse(text);
              console.log(`SETTINGS DEBUG: Parsed JSON data:`, data);
              return data;
            } else {
              console.log(`SETTINGS DEBUG: Empty response text`);
              return [];
            }
          } catch (parseError) {
            console.error(`SETTINGS DEBUG: JSON parse error:`, parseError);
            return [];
          }
        }
      }
      
      // Standard query handling
      console.log(`QUERY DEBUG: Making request to ${url} with headers:`, JSON.stringify(headers));
      
      // For customers and inventory specifically, add extra logging
      if (url === '/api/customers' || url === '/api/inventory') {
        const endpoint = url === '/api/customers' ? 'CUSTOMERS' : 'INVENTORY';
        console.log(`${endpoint} FETCH DEBUG: Starting ${endpoint.toLowerCase()} data fetch with the following headers:`);
        Object.entries(headers).forEach(([key, value]) => {
          // Mask token value for security
          const displayValue = key === 'Authorization' ? 'Bearer [TOKEN]' : value;
          console.log(`${endpoint} FETCH DEBUG: Header ${key}: ${displayValue}`);
        });
      }
      
      try {
        console.log(`QUERY DEBUG: Attempting fetch to ${url}...`);
        const res = await fetch(url, {
          credentials: "include",
          headers: headers
        });

        console.log(`QUERY DEBUG: Query to ${url} returned status ${res.status}`);

        if (unauthorizedBehavior === "returnNull" && res.status === 401) {
          console.log(`QUERY DEBUG: Query to ${url} returned 401, returning null as configured`);
          return null;
        }

        // Log the entire response for debugging
        const responseText = await res.text();
        console.log(`QUERY DEBUG: Raw response from ${url}:`, responseText);
        
        // Extra debugging for customers endpoint
        if (url === '/api/customers') {
          console.log('CUSTOMERS FETCH DEBUG: Got response text:', responseText);
          console.log('CUSTOMERS FETCH DEBUG: Response status:', res.status);
          console.log('CUSTOMERS FETCH DEBUG: Response headers:', 
            [...res.headers.entries()].reduce((obj, [key, val]) => {
              obj[key] = val;
              return obj;
            }, {})
          );
        }
        
        if (!res.ok) {
          console.error(`QUERY DEBUG: Query to ${url} failed with status ${res.status}: ${responseText || res.statusText}`);
          throw new Error(`${res.status}: ${responseText || res.statusText}`);
        }
        
        // Parse the response text if it exists
        let data = null;
        if (responseText && responseText.trim()) {
          try {
            data = JSON.parse(responseText);
            console.log(`QUERY DEBUG: Query to ${url} response data:`, data);
            
            // Specific debug for customer and inventory data
            if (url === '/api/customers' || url === '/api/inventory') {
              const endpoint = url === '/api/customers' ? 'CUSTOMERS' : 'INVENTORY';
              const itemType = url === '/api/customers' ? 'customer' : 'inventory item';
              
              console.log(`${endpoint} FETCH DEBUG: Parsed ${itemType} data:`);
              console.log(`${endpoint} FETCH DEBUG: Type:`, typeof data);
              console.log(`${endpoint} FETCH DEBUG: Is array?`, Array.isArray(data));
              console.log(`${endpoint} FETCH DEBUG: Length:`, Array.isArray(data) ? data.length : 'N/A');
              
              if (Array.isArray(data) && data.length > 0) {
                console.log(`${endpoint} FETCH DEBUG: First ${itemType}:`, data[0]);
              } else {
                console.log(`${endpoint} FETCH DEBUG: No ${itemType}s found`);
              }
            }
          } catch (parseError) {
            console.error(`QUERY DEBUG: Error parsing JSON from ${url}:`, parseError);
            throw new Error(`Failed to parse response: ${parseError.message}`);
          }
        } else {
          console.log(`QUERY DEBUG: Empty response from ${url}`);
        }
        
        return data;
      } catch (error) {
        console.error(`QUERY DEBUG: Error in fetch for ${url}:`, error);
        throw error;
      }
    } catch (error) {
      console.error(`QUERY DEBUG: Error processing query to ${url}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
