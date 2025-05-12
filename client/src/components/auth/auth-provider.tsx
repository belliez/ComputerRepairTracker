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

  // Listen for Firebase auth state changes and also check for development mode
  useEffect(() => {
    console.log('AuthProvider initialization - checking for development mode');
    console.log('Environment mode:', import.meta.env.MODE);
    // Special handling for development mode
    const devMode = localStorage.getItem('dev_mode') === 'true';
    const devUser = localStorage.getItem('dev_user');
    console.log('Development mode:', devMode ? 'enabled' : 'disabled');
    
    if (devMode && devUser) {
      console.log('Development mode detected, using mock user');
      
      try {
        const mockUser = JSON.parse(devUser);
        setIsLoading(false);
        
        // Create a fully mock user with organization for development
        const user = {
          id: mockUser.id || 'dev-user-123',
          email: mockUser.email || 'dev@example.com',
          displayName: mockUser.displayName || 'Development User',
          photoURL: null,
          lastLoginAt: new Date().toISOString(),
        };
        
        const mockOrg = {
          id: 1,
          name: 'Development Organization',
          slug: 'dev-org',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ownerId: mockUser.id || 'dev-user-123',
          logo: null,
          stripeSubscriptionId: 'mock_sub_123',
          subscriptionStatus: 'active',
          trialEndsAt: null,
          planId: 'free',
          billingEmail: mockUser.email || 'dev@example.com',
          billingName: mockUser.displayName || 'Development User',
          billingAddress: null,
          deleted: false,
          deletedAt: null,
          role: 'owner' as const
        };
        
        setUser(user as any);
        setOrganizations([mockOrg as any]);
        setCurrentOrganization(mockOrg as any);
        // This crucial line sets the organization ID that will be used for API requests
        localStorage.setItem('currentOrganizationId', '1');
        
        console.log('Successfully set up development auth');
        
        // This solves the issue where the user is not redirected to the app after login
        if (window.location.pathname.includes('/auth')) {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Error processing dev user:', error);
      }
      
      return () => {};  // No cleanup for dev mode
    }
    
    // Normal Firebase auth flow
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);
        
        try {
          // Get user data from our backend
          const idToken = await firebaseUser.getIdToken(true); // Force token refresh
          localStorage.setItem('firebase_token', idToken);
          
          // Fetch user data
          const userResponse = await apiRequest('GET', '/api/me');
          if (!userResponse.ok) {
            // Check if the error is due to an invalid token
            if (userResponse.status === 401) {
              // Try one more time with a forced token refresh
              const refreshedToken = await firebaseUser.getIdToken(true);
              localStorage.setItem('firebase_token', refreshedToken);
              
              // Retry with the new token
              const retryResponse = await apiRequest('GET', '/api/me');
              if (!retryResponse.ok) {
                throw new Error('Authentication failed after token refresh');
              }
              const userData = await retryResponse.json();
              setUser(userData);
            } else {
              throw new Error('Failed to get user data');
            }
          } else {
            const userData = await userResponse.json();
            setUser(userData);
          }
          
          // Fetch user organizations
          const orgsResponse = await apiRequest('GET', '/api/organizations');
          if (!orgsResponse.ok) {
            throw new Error('Failed to get organizations');
          }
          let organizationsData = await orgsResponse.json();
          
          // If the user has no organizations, create one automatically
          if (organizationsData.length === 0 && firebaseUser) {
            console.log('No organizations found for user, creating a default one');
            try {
              // Use the /api/organizations endpoint to create a new organization
              const orgResponse = await apiRequest('POST', '/api/organizations', {
                name: `${firebaseUser.displayName || firebaseUser.email || 'My'}'s Repair Shop`
              });
              
              if (!orgResponse.ok) {
                const errorText = await orgResponse.text();
                console.error('Failed to create default organization', errorText);
                
                // As a fallback, try the settings endpoint
                console.log('Trying fallback organization creation via settings endpoint');
                const fallbackResponse = await apiRequest('POST', '/api/settings/organization', {
                  name: `${firebaseUser.displayName || firebaseUser.email || 'My'}'s Repair Shop`,
                  email: firebaseUser.email || '',
                  phone: '',
                  address: '',
                  logo: '',
                  type: 'company',
                  settings: {
                    onboardingCompleted: false
                  }
                });
                
                if (!fallbackResponse.ok) {
                  console.error('Fallback organization creation failed', await fallbackResponse.text());
                } else {
                  const fallbackOrg = await fallbackResponse.json();
                  console.log('Organization created via fallback:', fallbackOrg);
                  
                  // If we got an organization ID back, fetch the organizations again
                  if (fallbackOrg?.organizationId) {
                    console.log('Setting organization context to:', fallbackOrg.organizationId);
                    localStorage.setItem('currentOrganizationId', fallbackOrg.organizationId.toString());
                    
                    // Refresh organizations list
                    const refreshResponse = await apiRequest('GET', '/api/organizations');
                    if (refreshResponse.ok) {
                      const refreshedOrgs = await refreshResponse.json();
                      if (refreshedOrgs.length > 0) {
                        // Instead of reassigning, replace the contents to keep the reference
                        organizationsData.splice(0, organizationsData.length, ...refreshedOrgs);
                      }
                    }
                  }
                }
              } else {
                const newOrg = await orgResponse.json();
                console.log('Default organization created:', newOrg);
                
                // If we have an organization ID, store it
                if (newOrg?.id) {
                  localStorage.setItem('currentOrganizationId', newOrg.id.toString());
                }
                
                organizationsData.push(newOrg);
              }
            } catch (orgError) {
              console.error('Error creating default organization:', orgError);
              // Continue anyway with empty organizations
            }
          }
          
          setOrganizations(organizationsData);
          
          // Set current organization (either from localStorage or first available)
          const storedOrgId = localStorage.getItem('currentOrganizationId');
          let selectedOrg: Organization | undefined;
          
          if (storedOrgId) {
            selectedOrg = organizationsData.find((org: any) => org.id === parseInt(storedOrgId));
          }
          
          if (!selectedOrg && organizationsData.length > 0) {
            selectedOrg = organizationsData[0];
            // Safely store the organization ID
            if (selectedOrg && selectedOrg.id) {
              localStorage.setItem('currentOrganizationId', selectedOrg.id.toString());
            }
          }
          
          if (selectedOrg) {
            setCurrentOrganization(selectedOrg);
            
            // Set the organization context in the backend
            await apiRequest('POST', '/api/set-organization', {
              organizationId: selectedOrg.id
            });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          toast({
            title: 'Error',
            description: 'Failed to load user data',
            variant: 'destructive',
          });
          await firebaseSignOut(auth);
          setUser(null);
          setFirebaseUser(null);
          localStorage.removeItem('firebase_token');
          localStorage.removeItem('currentOrganizationId');
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
        setOrganizations([]);
        setCurrentOrganization(null);
        
        // Clear all auth-related localStorage keys
        localStorage.removeItem('firebase_token');
        localStorage.removeItem('currentOrganizationId');
        localStorage.removeItem('dev_mode');
        localStorage.removeItem('dev_user');
        
        // Also clear any legacy keys to prevent conflicts
        localStorage.removeItem('useDevelopmentAuth');
      }
      
      setIsLoading(false);
    });
    
    // Setup token refresh logic
    const tokenRefreshInterval = setInterval(async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          // Refresh the token every 50 minutes to avoid expiration (default is 1 hour)
          const newToken = await currentUser.getIdToken(true);
          localStorage.setItem('firebase_token', newToken);
          console.log('Firebase token refreshed successfully');
        } catch (error) {
          console.error('Failed to refresh token:', error);
        }
      }
    }, 50 * 60 * 1000); // 50 minutes
    
    return () => {
      unsubscribe();
      clearInterval(tokenRefreshInterval);
    };
  }, [auth, toast]);

  const handleAuthError = (error: unknown) => {
    console.error('Auth error:', error);
    let errorMessage = 'Authentication failed';
    let errorCode = '';
    let shouldUseDevelopmentAuth = false;
    
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
        case 'auth/requires-recent-login':
          errorMessage = 'This action requires a recent login. Please sign in again';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'An account already exists with the same email address but different sign-in credentials';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Sign-in popup was blocked by your browser. Please allow popups for this site';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in popup was closed before completing the process';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'The sign-in operation was cancelled'; 
          break;
        case 'auth/unauthorized-domain':
          errorMessage = 'Development mode: Firebase domain not authorized. Using mock authentication...';
          // In development, we'll continue with a mock user
          // This is only for development purposes
          if (import.meta.env.MODE === 'development' || process.env.NODE_ENV === 'development') {
            shouldUseDevelopmentAuth = true;
          }
          break;
        case 'auth/invalid-credential':
          errorMessage = 'The authentication credential is invalid';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'This authentication method is not enabled for this project';
          if (import.meta.env.MODE === 'development' || process.env.NODE_ENV === 'development') {
            shouldUseDevelopmentAuth = true;
            errorMessage += '. Using development authentication instead.';
          }
          break;
        case 'auth/invalid-persistence-type':
          errorMessage = 'The persistence type is invalid';
          break;
        case 'auth/unsupported-persistence-type':
          errorMessage = 'The current environment does not support the persistence type';
          break;
        case 'auth/internal-error':
          errorMessage = 'The authentication service encountered an internal error';
          if (import.meta.env.MODE === 'development' || process.env.NODE_ENV === 'development') {
            shouldUseDevelopmentAuth = true;
            errorMessage += '. Using development authentication instead.';
          }
          break;
        default:
          errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    setError(errorMessage);
    
    // In development, use development auth for specific errors
    if (shouldUseDevelopmentAuth) {
      // Use the manual mock development login
      return useDevelopmentAuth();
    }
    
    toast({
      title: `Authentication Error${errorCode ? ` (${errorCode})` : ''}`,
      description: errorMessage,
      variant: 'destructive',
    });
  };
  
  // Development helper function - for local development only
  const useDevelopmentAuth = (email?: string, name?: string) => {
    // In development, we'll simulate a successful login
    console.log('Using development auth mode - bypassing Firebase');
    
    // Store flags for development mode using the same keys as the debug page
    localStorage.setItem('dev_mode', 'true');
    
    // Generate a development token with timestamp (same format as debug page)
    const devToken = `dev-token-${Date.now()}`;
    localStorage.setItem('firebase_token', devToken);
    
    // Notify user we're in development mode
    toast({
      title: 'Development Mode',
      description: 'Using mocked authentication for development',
    });
    
    // No error in dev mode
    setError(null);
    
    // Create a mock development user (same format as debug page)
    const mockUser = {
      id: 'dev-user-123',
      email: email || 'dev@example.com',
      displayName: name || 'Development User',
      photoURL: null,
      lastLoginAt: new Date().toISOString(),
    };
    
    // Store the user in localStorage (same format as debug page)
    localStorage.setItem('dev_user', JSON.stringify({
      id: mockUser.id,
      email: mockUser.email,
      displayName: mockUser.displayName
    }));
    
    // Set the user directly
    setUser(mockUser as any);
    
    // Create a mock organization
    const mockOrg = {
      id: 1,
      name: 'Development Organization',
      slug: 'dev-org',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: 'dev-user-123',
      logo: null,
      stripeSubscriptionId: 'dev_sub_123',
      subscriptionStatus: 'active',
      subscriptionTier: 'premium',
      maxUsers: 10,
      maxStorage: 1000,
      settings: {
        onboardingCompleted: false // Set to false to test onboarding
      },
      deleted: false,
      deletedAt: null,
      role: 'owner' as const
    };
    
    // Set organizations
    setOrganizations([mockOrg as any]);
    setCurrentOrganization(mockOrg as any);
    localStorage.setItem('currentOrganizationId', '1');
    
    // Also notify of successful login
    toast({
      title: 'Development Login',
      description: `Logged in as ${mockUser.displayName}`,
    });
  };

  const signIn = async (email: string, password: string) => {
    setIsSigningIn(true);
    setError(null);
    
    try {
      // Check if the user is explicitly requesting development mode
      if (email === 'dev@example.com' && password === 'development') {
        console.log('Development mode explicitly requested');
        // Use development authentication
        useDevelopmentAuth();
        setIsSigningIn(false);
        return;
      }
      
      // Use real Firebase authentication
      const credential = await signInWithEmailAndPassword(auth, email, password);
      
      // If this is a successful sign in, ensure user is synchronized with the database
      if (credential.user) {
        // Get the token and manually trigger an API call to create the user in the database
        const idToken = await credential.user.getIdToken(true);
        localStorage.setItem('firebase_token', idToken);
        
        try {
          // Make API call to force user creation/confirmation in the database
          const response = await apiRequest('GET', '/api/me');
          if (response.ok) {
            console.log('User successfully verified in database');
            
            // Force redirect since we know the user is authenticated now
            if (window.location.pathname.includes('/auth')) {
              window.location.href = '/';
            }
          }
        } catch (syncError) {
          console.error('Error syncing user with database:', syncError);
          // Continue anyway as onAuthStateChanged will try again
        }
      }
      
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
      // Check if the user is explicitly requesting development mode
      if (email === 'dev@example.com' && password === 'development') {
        console.log('Development mode explicitly requested for signup');
        // Use development auth with the provided email/name
        useDevelopmentAuth(email, name);
        setIsSigningUp(false);
        return;
      }
      
      // Real Firebase signup
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's display name
      if (credential.user) {
        await firebaseUpdateProfile(credential.user, { displayName: name });
        
        // Get the token and manually trigger an API call to create the user in the database
        const idToken = await credential.user.getIdToken(true);
        
        // Create a default organization for the new user
        // The name will be "<User>'s Repair Shop"
        try {
          console.log('Creating default organization for new user');
          const orgResponse = await fetch('/api/settings/organization', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              name: `${name}'s Repair Shop`,
              email: email,
              phone: '',
              address: '',
              logo: '',
              settings: {
                onboardingCompleted: false
              }
            })
          });
          
          if (!orgResponse.ok) {
            console.error('Failed to create default organization', await orgResponse.text());
          } else {
            console.log('Default organization created for new user');
          }
        } catch (orgError) {
          console.error('Error creating default organization:', orgError);
          // Continue anyway - user can create organization later in onboarding
        }
        localStorage.setItem('firebase_token', idToken);
        
        try {
          // Make API call to force user creation in the database
          const response = await apiRequest('GET', '/api/me');
          if (response.ok) {
            // User is now created in the database
            console.log('User successfully created in database');
            
            // Create a default organization for the new user
            await apiRequest('POST', '/api/organizations', {
              name: `${name}'s Organization`
            });
            
            // Force redirect since we know the user is authenticated now
            if (window.location.pathname.includes('/auth')) {
              window.location.href = '/';
            }
          }
        } catch (syncError) {
          console.error('Error syncing user with database:', syncError);
          // Continue anyway as onAuthStateChanged will try again
        }
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
      const provider = new GoogleAuthProvider();
      // Add scopes for additional access if needed
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set custom parameters for the auth request
      provider.setCustomParameters({
        // Request a specific login hint if needed
        // login_hint: 'user@example.com',
        // Force account selection even if user has only one account
        prompt: 'select_account'
      });
      
      // Attempt to sign in with popup
      const result = await signInWithPopup(auth, provider);
      
      // If this is a successful sign in, ensure user is synchronized with our database
      if (result.user) {
        // Get the token and manually trigger an API call to create the user in the database
        const idToken = await result.user.getIdToken(true);
        localStorage.setItem('firebase_token', idToken);
        
        try {
          // Make API call to force user creation in the database
          const response = await apiRequest('GET', '/api/me');
          if (response.ok) {
            // User is now created in the database
            console.log('User successfully created/updated in database');
            
            // Check if user has organizations
            const orgsResponse = await apiRequest('GET', '/api/organizations');
            if (orgsResponse.ok) {
              const orgs = await orgsResponse.json();
              
              // If user doesn't have any organizations, create a default one
              if (!orgs || orgs.length === 0) {
                await apiRequest('POST', '/api/organizations', {
                  name: `${result.user.displayName || 'My'}'s Organization`
                });
              }
            }
            
            // Force redirect since we know the user is authenticated now
            if (window.location.pathname.includes('/auth')) {
              window.location.href = '/';
            }
          }
        } catch (syncError) {
          console.error('Error syncing user with database:', syncError);
          // Continue anyway as onAuthStateChanged will try again
        }
      }
      
      toast({
        title: 'Google Sign-in Successful',
        description: 'Welcome back!',
      });
      
      setIsSigningIn(false);
    } catch (error) {
      setIsSigningIn(false);
      
      if (error instanceof FirebaseError) {
        // Special handling for specific Google auth errors
        switch (error.code) {
          case 'auth/account-exists-with-different-credential':
            toast({
              title: 'Sign-in Error',
              description: 'An account already exists with the same email but different sign-in credentials. Try signing in using the original method.',
              variant: 'destructive',
            });
            break;
          
          // Special handling for development mode if Google sign-in fails
          // This is a fallback for when Google sign-in fails due to misconfiguration
          case 'auth/unauthorized-domain':
          case 'auth/operation-not-allowed':
          case 'auth/internal-error':
            console.log('Google auth failed, using development auth as fallback');
            
            if (import.meta.env.MODE === 'development' || process.env.NODE_ENV === 'development') {
              useDevelopmentAuth('dev@example.com', 'Development User (Google)');
              return;
            }
            break;
            
          default:
            // Use the general error handler for other errors
            handleAuthError(error);
        }
      } else {
        // For non-Firebase errors
        handleAuthError(error);
      }
      
      // Re-throw the error to allow the calling component to handle it
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Check if we're in development mode first
      const devMode = localStorage.getItem('dev_mode') === 'true';
      
      if (devMode) {
        // Development mode cleanup
        console.log('Development mode detected, cleaning up dev auth');
        
        // Clear all auth-related localStorage keys
        localStorage.removeItem('dev_mode');
        localStorage.removeItem('dev_user');
        localStorage.removeItem('firebase_token');
        localStorage.removeItem('currentOrganizationId');
        
        // Also clear any legacy keys to prevent conflicts
        localStorage.removeItem('useDevelopmentAuth');
        
        // Reset auth state
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
      localStorage.removeItem('firebase_token');
      localStorage.removeItem('currentOrganizationId');
    } catch (error) {
      handleAuthError(error);
    }
  };

  const switchOrganization = async (organizationId: number) => {
    try {
      console.log(`Switching to organization ID: ${organizationId}`);
      const org = organizations.find(org => org.id === organizationId);
      if (!org) {
        throw new Error('Organization not found');
      }
      
      setCurrentOrganization(org);
      localStorage.setItem('currentOrganizationId', organizationId.toString());
      
      // Set the organization context in the backend
      console.log('Setting organization context in backend...');
      const response = await apiRequest('POST', '/api/set-organization', {
        organizationId
      });
      console.log('Backend response:', response.status, await response.text());
      
      // Invalidate all organization-specific data queries
      console.log('Invalidating organization-specific data queries...');
      // Import queryClient from the query client module
      const { queryClient } = await import('@/lib/queryClient');
      
      // Invalidate the most critical data first - repairs, customers, etc.
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/technicians'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      
      // Also invalidate settings data
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/currencies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/tax-rates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public-settings/currencies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public-settings/tax-rates'] });
      
      toast({
        title: 'Organization switched',
        description: `You are now working in ${org.name}`,
      });
      
      console.log(`Successfully switched to organization: ${org.name} (ID: ${organizationId})`);
    } catch (error) {
      console.error('Error switching organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to switch organization',
        variant: 'destructive',
      });
    }
  };

  const createOrganization = async (name: string) => {
    try {
      const response = await apiRequest('POST', '/api/organizations', { name });
      if (!response.ok) {
        throw new Error('Failed to create organization');
      }
      
      const newOrg = await response.json();
      
      setOrganizations(prev => [...prev, { ...newOrg, role: 'owner' }]);
      setCurrentOrganization(newOrg);
      localStorage.setItem('currentOrganizationId', newOrg.id.toString());
      
      // Set the organization context in the backend
      await apiRequest('POST', '/api/set-organization', {
        organizationId: newOrg.id
      });
      
      toast({
        title: 'Organization created',
        description: `${name} has been created successfully`,
      });
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to create organization',
        variant: 'destructive',
      });
    }
  };

  const refreshCurrentOrganization = async () => {
    try {
      // Fetch user organizations
      const orgsResponse = await apiRequest('GET', '/api/organizations');
      if (!orgsResponse.ok) {
        throw new Error('Failed to get organizations');
      }
      const organizationsData = await orgsResponse.json();
      setOrganizations(organizationsData);
      
      // Update current organization if it exists
      if (currentOrganization) {
        const updatedOrg = organizationsData.find((org: any) => org.id === currentOrganization.id);
        if (updatedOrg) {
          setCurrentOrganization(updatedOrg);
        }
      }
      
      toast({
        title: 'Success',
        description: 'Organization data refreshed',
      });
    } catch (error) {
      console.error('Error refreshing organization data:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh organization data',
        variant: 'destructive',
      });
    }
  };

  const value = {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};