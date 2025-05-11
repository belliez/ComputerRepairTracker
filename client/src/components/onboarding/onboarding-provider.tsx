import React, { useState, useEffect, createContext, useContext } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { OnboardingModal } from './onboarding-modal';

interface OnboardingContextType {
  isOnboardingComplete: boolean;
  showOnboarding: () => void;
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
  const { currentOrganization } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(true);

  useEffect(() => {
    // Check if onboarding is completed from organization settings
    if (currentOrganization) {
      const settings = currentOrganization.settings as any;
      const completed = settings?.onboardingCompleted || false;
      setIsOnboardingComplete(completed);
      
      // Show onboarding modal for new organizations that haven't completed onboarding
      if (!completed) {
        setShowModal(true);
      }
    }
  }, [currentOrganization]);

  const showOnboarding = () => {
    setShowModal(true);
  };

  return (
    <OnboardingContext.Provider value={{ isOnboardingComplete, showOnboarding }}>
      {children}
      <OnboardingModal 
        open={showModal} 
        onClose={() => setShowModal(false)} 
      />
    </OnboardingContext.Provider>
  );
};