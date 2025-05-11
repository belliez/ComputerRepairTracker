import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
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
  
  // Add Authorization header with appropriate token
  if (firebaseToken) {
    console.log('Adding auth header with token for API request');
    headers["Authorization"] = `Bearer ${firebaseToken}`;
  } else if (devMode) {
    // Create a new dev token if needed for dev mode
    console.log('Creating new dev token for API request');
    const newDevToken = 'dev-token-' + Date.now();
    localStorage.setItem('firebase_token', newDevToken);
    headers["Authorization"] = `Bearer ${newDevToken}`;
  } else {
    console.log('No auth token available for API request');
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
    
    // Add Authorization header with appropriate token
    if (firebaseToken) {
      console.log('Adding auth header with token for query');
      headers["Authorization"] = `Bearer ${firebaseToken}`;
    } else if (devMode) {
      // Create a new dev token if needed for dev mode
      console.log('Creating new dev token for query');
      const newDevToken = 'dev-token-' + Date.now();
      localStorage.setItem('firebase_token', newDevToken);
      headers["Authorization"] = `Bearer ${newDevToken}`;
    } else {
      console.log('No auth token available for query');
    }
    
    const url = queryKey[0] as string;
    console.log(`Making query to ${url}`);
    
    const res = await fetch(url, {
      credentials: "include",
      headers: headers
    });

    console.log(`Query to ${url} returned status ${res.status}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`Query to ${url} returned 401, returning null as configured`);
      return null;
    }

    try {
      await throwIfResNotOk(res);
      const data = await res.json();
      console.log(`Query to ${url} response data:`, data);
      return data;
    } catch (error) {
      console.error(`Error processing query to ${url}:`, error);
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
