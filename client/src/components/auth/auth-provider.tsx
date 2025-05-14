import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { User, Organization } from '@shared/schema';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  User as FirebaseUser,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import '../../firebase-config';
import { apiRequest } from '@/lib/queryClient';

type OrganizationWithRole = Organization & { role: 'owner' | 'member' | 'admin' };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSigningIn: boolean;
  isSigningUp: boolean;
  error: string | null;
  organizations: OrganizationWithRole[];
  currentOrganization: Organization | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  switchOrganization: (organizationId: number) => Promise<void>;
  createOrganization: (name: string) => Promise<void>;
  refreshCurrentOrganization: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const auth = getAuth();
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);

  // Development helper function
  const useDevelopmentAuth = (email: string = 'dev@example.com', name: string = 'Development User') => {
    console.log('Using development auth mode');
    
    localStorage.setItem('dev_mode', 'true');
    localStorage.setItem('dev_user', JSON.stringify({
      id: 'dev-user-123',
      email: email,
      displayName: name,
    }));
    
    const devToken = `dev-token-${Date.now()}`;
    localStorage.setItem('firebase_token', devToken);
    
    toast({
      title: 'Development Mode',
      description: 'Using development authentication',
    });
    
    // Force immediate redirect to home page if on auth page
    if (window.location.pathname.includes('/auth')) {
      console.log("Detected auth page, forcing redirect to home");
      // Use setTimeout to ensure toast is shown first
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    }
  };

  const handleAuthError = (error: unknown) => {
    console.error('Auth error:', error);
    let errorMessage = 'Authentication failed';
    let errorCode = '';
    
    if (error instanceof FirebaseError) {
      errorCode = error.code;
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'Email already in use';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Sign-in popup was blocked. Please allow popups for this site';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in popup was closed before completing';
          break;
        default:
          errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    setError(errorMessage);
    
    toast({
      title: `Authentication Error${errorCode ? ` (${errorCode})` : ''}`,
      description: errorMessage,
      variant: 'destructive',
    });
  };

  const signIn = async (email: string, password: string) => {
    setIsSigningIn(true);
    setError(null);
    
    try {
      // Development mode
      if (email === 'dev@example.com' && password === 'development') {
        useDevelopmentAuth(email, 'Development User');
        setIsSigningIn(false);
        return;
      }
      
      // Real Firebase login
      await signInWithEmailAndPassword(auth, email, password);
      setIsSigningIn(false);
    } catch (error) {
      setIsSigningIn(false);
      handleAuthError(error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setIsSigningUp(true);
    setError(null);
    
    try {
      // Development mode
      if (email === 'dev@example.com' && password === 'development') {
        useDevelopmentAuth(email, name);
        setIsSigningUp(false);
        return;
      }
      
      // Real Firebase signup
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's display name
      if (credential.user) {
        await firebaseUpdateProfile(credential.user, { displayName: name });
      }
      
      setIsSigningUp(false);
    } catch (error) {
      setIsSigningUp(false);
      handleAuthError(error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    setError(null);
    
    try {
      console.log("Starting Google sign-in process");
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set custom parameters
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Development mode check
      if (import.meta.env.MODE === 'development') {
        console.log('Development mode detected during Google sign-in');
        
        // If Firebase config is missing, use dev auth
        if (!import.meta.env.VITE_FIREBASE_API_KEY || 
            !import.meta.env.VITE_FIREBASE_PROJECT_ID || 
            !import.meta.env.VITE_FIREBASE_APP_ID) {
          useDevelopmentAuth('dev@example.com', 'Development User (Google)');
          setIsSigningIn(false);
          return;
        }
      }
      
      // First try popup
      try {
        console.log("Attempting Google sign-in with popup");
        const result = await signInWithPopup(auth, provider);
        console.log("Google popup sign-in successful");
      } 
      catch (popupError) {
        console.error("Google popup sign-in failed:", popupError);
        
        // If popup fails, try redirect
        if (import.meta.env.MODE === 'development') {
          console.log('Using development auth due to popup error');
          useDevelopmentAuth('dev@example.com', 'Development User (Google)');
          setIsSigningIn(false);
          return;
        }
        
        // For production, attempt redirect
        toast({
          title: "Google Sign-In",
          description: "Switching to redirect method...",
          duration: 3000,
        });
        
        // Redirect method as fallback
        try {
          console.log("Attempting Google sign-in with redirect");
          await signInWithRedirect(auth, provider);
          console.log("Google redirect initiated");
        } 
        catch (redirectError) {
          console.error("Google redirect sign-in failed:", redirectError);
          throw redirectError;
        }
      }
      
      setIsSigningIn(false);
    } 
    catch (error) {
      console.error("Google sign-in error:", error);
      setIsSigningIn(false);
      handleAuthError(error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Check for development mode
      const devMode = localStorage.getItem('dev_mode') === 'true';
      
      if (devMode) {
        // Clear development mode data
        localStorage.removeItem('dev_mode');
        localStorage.removeItem('dev_user');
        localStorage.removeItem('firebase_token');
        
        // Reset state
        setUser(null);
        setFirebaseUser(null);
        setCurrentOrganization(null);
        setOrganizations([]);
        
        toast({
          title: 'Signed Out',
          description: 'You have been signed out of development mode',
        });
        
        return;
      }
      
      // Normal Firebase signout
      await firebaseSignOut(auth);
      
      toast({
        title: 'Signed Out',
        description: 'You have been signed out successfully',
      });
    } catch (error) {
      handleAuthError(error);
      throw error;
    }
  };

  const switchOrganization = async (organizationId: number) => {
    try {
      // Find the organization in the list
      const org = organizations.find(org => org.id === organizationId);
      
      if (!org) {
        throw new Error('Organization not found');
      }
      
      // Set as current organization
      setCurrentOrganization(org);
      
      // Store in localStorage
      localStorage.setItem('currentOrganizationId', organizationId.toString());
      
      // Call the API to set organization context
      await apiRequest('POST', '/api/set-organization', {
        organizationId
      });
      
      toast({
        title: 'Organization Switched',
        description: `You are now working in ${org.name}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to switch organization',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const createOrganization = async (name: string) => {
    try {
      const response = await apiRequest('POST', '/api/organizations', { name });
      
      if (!response.ok) {
        throw new Error('Failed to create organization');
      }
      
      const newOrg = await response.json();
      
      // Update organizations list
      setOrganizations(prev => [...prev, newOrg]);
      
      // Switch to new organization
      await switchOrganization(newOrg.id);
      
      toast({
        title: 'Organization Created',
        description: `${name} has been created successfully`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create organization',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const refreshCurrentOrganization = async () => {
    try {
      // Refresh organizations list
      const orgsResponse = await apiRequest('GET', '/api/organizations');
      
      if (!orgsResponse.ok) {
        throw new Error('Failed to refresh organizations');
      }
      
      const orgs = await orgsResponse.json();
      setOrganizations(orgs);
      
      // Update current organization
      if (currentOrganization) {
        const updated = orgs.find((o: any) => o.id === currentOrganization.id);
        if (updated) {
          setCurrentOrganization(updated);
        }
      }
      
      toast({
        title: 'Refreshed',
        description: 'Organization data has been refreshed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh organization data',
        variant: 'destructive',
      });
    }
  };

  // Auth state listener
  useEffect(() => {
    console.log('Setting up auth state listener');
    
    // Check for development mode
    const devMode = localStorage.getItem('dev_mode') === 'true';
    const devUser = localStorage.getItem('dev_user');
    
    if (devMode && devUser) {
      console.log('Development mode detected');
      
      try {
        const mockUser = JSON.parse(devUser);
        
        // Create mock user
        setUser({
          id: mockUser.id || 'dev-user-123',
          email: mockUser.email || 'dev@example.com',
          displayName: mockUser.displayName || 'Development User',
          photoURL: null,
          lastLoginAt: new Date().toISOString(),
        } as any);
        
        // Create mock organization
        const mockOrg = {
          id: 1,
          name: 'Development Organization',
          slug: 'dev-org',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ownerId: mockUser.id || 'dev-user-123',
          logo: null,
          role: 'owner' as const
        };
        
        setOrganizations([mockOrg as any]);
        setCurrentOrganization(mockOrg as any);
        localStorage.setItem('currentOrganizationId', '1');
        
        setIsLoading(false);
        return () => {};
      } catch (error) {
        console.error('Error processing dev user:', error);
      }
    }
    
    // Real Firebase auth listener
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setIsLoading(true);
      
      if (fbUser) {
        setFirebaseUser(fbUser);
        
        try {
          // Get token and fetch user data
          const idToken = await fbUser.getIdToken(true);
          localStorage.setItem('firebase_token', idToken);
          
          const userResponse = await apiRequest('GET', '/api/me');
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setUser(userData);
            
            // Fetch organizations
            const orgsResponse = await apiRequest('GET', '/api/organizations');
            if (orgsResponse.ok) {
              const orgsData = await orgsResponse.json();
              setOrganizations(orgsData);
              
              // Set current organization
              const storedOrgId = localStorage.getItem('currentOrganizationId');
              let selectedOrg: Organization | undefined;
              
              if (storedOrgId) {
                selectedOrg = orgsData.find((org: any) => org.id === parseInt(storedOrgId));
              }
              
              if (!selectedOrg && orgsData.length > 0) {
                selectedOrg = orgsData[0];
                localStorage.setItem('currentOrganizationId', selectedOrg.id.toString());
              }
              
              if (selectedOrg) {
                setCurrentOrganization(selectedOrg);
                
                // Set organization context in backend
                await apiRequest('POST', '/api/set-organization', {
                  organizationId: selectedOrg.id
                });
              }
            }
          } else {
            // Handle authentication error
            throw new Error('Failed to get user data');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          await signOut();
        }
      } else {
        // No user signed in
        setUser(null);
        setFirebaseUser(null);
        setOrganizations([]);
        setCurrentOrganization(null);
        
        // Clear auth data
        localStorage.removeItem('firebase_token');
        localStorage.removeItem('currentOrganizationId');
        localStorage.removeItem('dev_mode');
        localStorage.removeItem('dev_user');
      }
      
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [auth, toast]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSigningIn,
        isSigningUp,
        error,
        organizations,
        currentOrganization,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        switchOrganization,
        createOrganization,
        refreshCurrentOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;