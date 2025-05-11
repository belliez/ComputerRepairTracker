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
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
