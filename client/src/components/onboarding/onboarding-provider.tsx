import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { OnboardingModal } from './onboarding-modal';

interface OnboardingContextType {
  isOnboardingComplete: boolean;
  isShowingOnboarding: boolean;
  showOnboarding: () => void;
  hideOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentOrganization, user } = useAuth();
  const [isShowingOnboarding, setIsShowingOnboarding] = useState<boolean>(false);
  
  // Detect if onboarding is complete from the organization settings
  const isOnboardingComplete = React.useMemo(() => {
    if (!currentOrganization) return false;
    
    // Safely access the settings property which might be undefined
    const settings = currentOrganization.settings || {};
    
    // Debug - log what we're seeing
    console.log('Checking onboarding status:', { 
      settings, 
      onboardingCompleted: settings.onboardingCompleted,
      organizationId: currentOrganization.id
    });
    
    // Check if onboardingCompleted is explicitly true
    return settings.onboardingCompleted === true;
  }, [currentOrganization]);
  
  // Show onboarding automatically if user is logged in but onboarding is not complete
  useEffect(() => {
    if (user && currentOrganization && !isOnboardingComplete) {
      // Give a small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        setIsShowingOnboarding(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, currentOrganization, isOnboardingComplete]);
  
  const showOnboarding = () => {
    setIsShowingOnboarding(true);
  };
  
  const hideOnboarding = () => {
    setIsShowingOnboarding(false);
  };
  
  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingComplete,
        isShowingOnboarding,
        showOnboarding,
        hideOnboarding,
      }}
    >
      {children}
      {user && currentOrganization && (
        <OnboardingModal
          isOpen={isShowingOnboarding}
          onClose={hideOnboarding}
        />
      )}
    </OnboardingContext.Provider>
  );
};