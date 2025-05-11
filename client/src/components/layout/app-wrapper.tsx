import React from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider';
import { Toaster } from '@/components/ui/toaster';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

export function AppWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OnboardingProvider>
          {children}
          <Toaster />
        </OnboardingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}