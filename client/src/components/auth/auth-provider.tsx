import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider, 
  signInWithPopup,
  signOut as firebaseSignOut,
  UserCredential
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { User, Organization } from '@shared/schema';

// Define types for auth context
interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  isSigningIn: boolean;
  isSigningUp: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<UserCredential>;
  signInWithGoogle: () => Promise<UserCredential>;
  signUp: (email: string, password: string, displayName: string) => Promise<UserCredential>;
  signOut: () => Promise<void>;
  createOrganization: (name: string) => Promise<Organization>;
  switchOrganization: (organizationId: number) => void;
}

// Create auth context
const AuthContext = createContext<AuthContextType | null>(null);

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for authentication
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<number | null>(null);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        // Reset state when user signs in
        setError(null);
      }
    });

    // Clean up subscription
    return () => unsubscribe();
  }, []);

  // Fetch user data from API when Firebase user changes
  const { 
    data: userData,
    isLoading: isUserLoading 
  } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      if (!firebaseUser) return null;
      
      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch('/api/user', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch user data');
        }
        
        return res.json();
      } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
      }
    },
    enabled: !!firebaseUser,
  });

  // Fetch organizations for the current user
  const { 
    data: organizations = [],
    isLoading: isOrgsLoading 
  } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      if (!firebaseUser) return [];
      
      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch('/api/organizations', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch organizations');
        }
        
        return res.json();
      } catch (error) {
        console.error('Error fetching organizations:', error);
        return [];
      }
    },
    enabled: !!firebaseUser,
  });

  // Get current organization
  const currentOrganization = organizations.find((org: Organization) => org.id === currentOrganizationId) || 
                             (organizations.length > 0 ? organizations[0] : null);
  
  // Effect to set default organization when orgs load
  useEffect(() => {
    if (organizations.length > 0 && !currentOrganizationId) {
      setCurrentOrganizationId(organizations[0].id);
    }
  }, [organizations, currentOrganizationId]);

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    setIsSigningIn(true);
    setError(null);
    
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Signed in successfully",
        description: `Welcome back, ${email}!`,
      });
      return result;
    } catch (error: any) {
      console.error('Sign in error:', error);
      const errorMessage = error.message || 'Failed to sign in';
      setError(errorMessage);
      toast({
        title: "Sign in failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setIsSigningIn(true);
    setError(null);
    
    try {
      const result = await signInWithPopup(auth, provider);
      toast({
        title: "Signed in with Google",
        description: `Welcome, ${result.user.displayName || result.user.email}!`,
      });
      return result;
    } catch (error: any) {
      console.error('Google sign in error:', error);
      const errorMessage = error.message || 'Failed to sign in with Google';
      setError(errorMessage);
      toast({
        title: "Google sign in failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  // Sign up with email/password
  const signUp = async (email: string, password: string, displayName: string) => {
    setIsSigningUp(true);
    setError(null);
    
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update user profile with display name
      await result.user.updateProfile({ displayName });
      
      toast({
        title: "Signed up successfully",
        description: `Welcome, ${displayName}!`,
      });
      
      return result;
    } catch (error: any) {
      console.error('Sign up error:', error);
      const errorMessage = error.message || 'Failed to sign up';
      setError(errorMessage);
      toast({
        title: "Sign up failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSigningUp(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      // Clear all query cache
      queryClient.clear();
      
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign out failed",
        description: error.message || 'Failed to sign out',
        variant: "destructive",
      });
      throw error;
    }
  };

  // Create organization mutation
  const createOrganizationMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!firebaseUser) {
        throw new Error('You must be logged in to create an organization');
      }
      
      const idToken = await firebaseUser.getIdToken();
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      const response = await apiRequest('POST', '/api/organizations', { 
        name, 
        slug
      }, {
        'Authorization': `Bearer ${idToken}`
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create organization');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setCurrentOrganizationId(data.id);
      toast({
        title: "Organization created",
        description: `Successfully created ${data.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create organization",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create organization helper
  const createOrganization = async (name: string) => {
    return createOrganizationMutation.mutateAsync(name);
  };

  // Switch organization
  const switchOrganization = (organizationId: number) => {
    setCurrentOrganizationId(organizationId);
    // Invalidate all data that's org-specific
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['devices'] });
    queryClient.invalidateQueries({ queryKey: ['repairs'] });
    queryClient.invalidateQueries({ queryKey: ['technicians'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    
    toast({
      title: "Organization switched",
      description: `Now viewing ${organizations.find(org => org.id === organizationId)?.name}`,
    });
  };

  // Combine loading states
  const isLoading = isUserLoading || isOrgsLoading;

  // Get user from userData
  const user = userData?.user || null;

  // Auth context value
  const value: AuthContextType = {
    user,
    firebaseUser,
    currentOrganization,
    organizations,
    isLoading,
    isSigningIn,
    isSigningUp,
    error,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    createOrganization,
    switchOrganization,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};