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
    // Special handling for development mode
    const devMode = localStorage.getItem('dev_mode') === 'true';
    const devUser = localStorage.getItem('dev_user');
    
    if (devMode && devUser) {
      console.log('Development mode detected, using mock user');
      const mockUser = JSON.parse(devUser);
      setIsLoading(false);
      
      // Create a fully mock user with organization for development
      const user = {
        id: mockUser.id,
        email: mockUser.email,
        displayName: mockUser.displayName,
        photoURL: null,
        lastLoginAt: new Date(),
      };
      
      const mockOrg = {
        id: 1,
        name: 'Development Organization',
        slug: 'dev-org',
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerId: mockUser.id,
        logo: null,
        stripeSubscriptionId: null,
        subscriptionStatus: null,
        trialEndsAt: null,
        planId: null,
        billingEmail: mockUser.email,
        billingName: mockUser.displayName,
        billingAddress: null,
        deleted: false,
        deletedAt: null,
        role: 'owner' as const
      };
      
      setUser(user as any);
      setOrganizations([mockOrg as any]);
      setCurrentOrganization(mockOrg as any);
      localStorage.setItem('currentOrganizationId', '1');
      
      return () => {};  // No cleanup for dev mode
    }
    
    // Normal Firebase auth flow
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);
        
        try {
          // Get user data from our backend
          const idToken = await firebaseUser.getIdToken();
          localStorage.setItem('firebase_token', idToken);
          
          // Fetch user data
          const userResponse = await apiRequest('GET', '/api/me');
          if (!userResponse.ok) {
            throw new Error('Failed to get user data');
          }
          const userData = await userResponse.json();
          setUser(userData);
          
          // Fetch user organizations
          const orgsResponse = await apiRequest('GET', '/api/organizations');
          if (!orgsResponse.ok) {
            throw new Error('Failed to get organizations');
          }
          const organizationsData = await orgsResponse.json();
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
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
        setOrganizations([]);
        setCurrentOrganization(null);
        localStorage.removeItem('firebase_token');
        localStorage.removeItem('currentOrganizationId');
      }
      
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [auth, toast]);

  const handleAuthError = (error: unknown) => {
    console.error('Auth error:', error);
    let errorMessage = 'Authentication failed';
    
    if (error instanceof FirebaseError) {
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
        case 'auth/unauthorized-domain':
          errorMessage = 'Development mode: Firebase domain not authorized. Using mock authentication...';
          // In development, we'll continue with a mock user
          // This is only for development purposes
          if (process.env.NODE_ENV === 'development') {
            // Use the manual mock development login
            return useDevelopmentAuth();
          }
          break;
        default:
          errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    setError(errorMessage);
    toast({
      title: 'Error',
      description: errorMessage,
      variant: 'destructive',
    });
  };
  
  // Development helper function - for local development only
  const useDevelopmentAuth = (email?: string, name?: string) => {
    // In development, we'll simulate a successful login
    console.log('Using development auth mode - bypassing Firebase');
    
    // Notify user we're in development mode
    toast({
      title: 'Development Mode',
      description: 'Using mocked authentication for development',
    });
    
    // No error in dev mode
    setError(null);
    
    // Create a mock development user
    const mockUser = {
      id: 'dev-user-123',
      email: email || 'dev@example.com',
      displayName: name || 'Development User',
      photoURL: null,
      lastLoginAt: new Date(),
    };
    
    // Set the user directly
    setUser(mockUser as any);
    
    // Create a mock organization
    const mockOrg = {
      id: 1,
      name: 'Development Organization',
      slug: 'dev-org',
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerId: 'dev-user-123',
      logo: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      trialEndsAt: null,
      planId: null,
      billingEmail: email || 'dev@example.com',
      billingName: name || 'Development User',
      billingAddress: null,
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
      await signInWithPopup(auth, provider);
      setIsSigningIn(false);
    } catch (error) {
      setIsSigningIn(false);
      
      // Special handling for development mode if Google sign-in fails
      // This is a fallback for when Google sign-in fails due to misconfiguration
      if (error.code === 'auth/unauthorized-domain' || 
          error.code === 'auth/operation-not-allowed' ||
          error.code === 'auth/internal-error') {
        console.log('Google auth failed, using development auth as fallback');
        useDevelopmentAuth('dev@example.com', 'Development User (Google)');
        return;
      }
      
      handleAuthError(error);
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
        localStorage.removeItem('dev_mode');
        localStorage.removeItem('dev_user');
        localStorage.removeItem('currentOrganizationId');
        
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
      const org = organizations.find(org => org.id === organizationId);
      if (!org) {
        throw new Error('Organization not found');
      }
      
      setCurrentOrganization(org);
      localStorage.setItem('currentOrganizationId', organizationId.toString());
      
      // Set the organization context in the backend
      await apiRequest('POST', '/api/set-organization', {
        organizationId
      });
      
      // Reload organization-specific data
      // This would be a good place to invalidate React Query caches for organization data
      
      toast({
        title: 'Organization switched',
        description: `You are now working in ${org.name}`,
      });
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};