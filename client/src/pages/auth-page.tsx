import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/auth/auth-provider';
import { useLocation } from 'wouter';
import { Loader2, Mail, BugPlay } from 'lucide-react';

const AuthPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { 
    user, 
    signIn, 
    signUp, 
    signInWithGoogle, 
    isLoading, 
    isSigningIn, 
    isSigningUp 
  } = useAuth();
  
  // Development login function - only visible in development builds
  // This is a direct method to bypass Firebase authentication
  const isDevelopment = process.env.NODE_ENV === 'development' || import.meta.env.MODE === 'development';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [activeTab, setActiveTab] = useState('login');

  // Redirect to home if already logged in
  if (user) {
    setLocation('/');
    return null;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log("Starting sign-in with email:", email);
      await signIn(email, password);
      console.log("Sign-in completed successfully");
      toast({
        title: 'Sign in successful',
        description: 'Welcome back!',
      });
      
      // Force redirect to dashboard
      window.location.href = '/';
    } catch (error: any) {
      console.error("Sign-in error in auth-page:", error);
      // Show fallback error message
      toast({
        title: "Sign-in Failed",
        description: error.message || "Could not sign in with these credentials. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log("Starting registration with email:", email);
      await signUp(email, password, name);
      console.log("Registration completed successfully");
      toast({
        title: 'Sign up successful',
        description: 'Welcome to RepairTrack!',
      });
      
      // Force redirect to dashboard
      window.location.href = '/';
    } catch (error: any) {
      console.error("Registration error in auth-page:", error);
      // Show fallback error message
      toast({
        title: "Registration Failed",
        description: error.message || "Could not create your account. Please try again with a different email.",
        variant: "destructive",
      });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      console.log("Starting Google sign-in from Auth page");
      await signInWithGoogle();
      console.log("Google sign-in completed successfully");
      
      // Force redirect to dashboard
      window.location.href = '/';
    } catch (error: any) {
      console.error("Google sign-in error in auth-page:", error);
      // Show fallback error message
      toast({
        title: "Google Sign-In Failed",
        description: error.message || "Could not sign in with Google. Please try again or use another method.",
        variant: "destructive",
      });
    }
  };
  
  // Handle direct development login (bypass Firebase)
  const handleDevLogin = () => {
    try {
      // Call the development login endpoint
      fetch('/api/dev-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'dev@example.com',
          name: 'Development User'
        }),
      }).then((response) => {
        if (!response.ok) {
          throw new Error('Failed to call development login endpoint');
        }
        return response.json();
      }).then((data) => {
        // Create direct implementation of dev auth flow in the client
        
        // Create a mock development user directly in localStorage
        localStorage.setItem('dev_mode', 'true');
        localStorage.setItem('dev_user', JSON.stringify({
          id: 'dev-user-123',
          email: 'dev@example.com',
          displayName: 'Development User',
        }));
        
        // Create a mock Firebase token for development authentication
        // This will be a fake token but the server will allow it in development mode
        const mockToken = 'dev-token-' + Date.now();
        localStorage.setItem('firebase_token', mockToken);
        
        toast({
          title: 'Development Mode',
          description: 'Using development authentication',
        });
        
        // Force redirect to dashboard
        window.location.href = '/';
      }).catch(error => {
        throw error;
      });
    } catch (error) {
      console.error('Development login error:', error);
      toast({
        title: 'Error',
        description: 'Development login failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side: Auth form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary">RepairTrack</h1>
            <p className="text-muted-foreground mt-2">
              Professional repair shop management system
            </p>
          </div>

          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sign In</CardTitle>
                  <CardDescription>
                    Enter your credentials to access your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="email@example.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Button variant="link" size="sm" className="px-0 font-normal" type="button">
                          Forgot password?
                        </Button>
                      </div>
                      <Input 
                        id="password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSigningIn}>
                      {isSigningIn ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing In
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                  </form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleGoogleSignIn}
                    disabled={isSigningIn}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Sign in with Google
                  </Button>
                  
                  {isDevelopment && (
                    <Button 
                      variant="secondary" 
                      className="w-full" 
                      onClick={handleDevLogin}
                    >
                      <BugPlay className="mr-2 h-4 w-4" />
                      Development Login
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="register" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Create an account</CardTitle>
                  <CardDescription>
                    Enter your details to create a new account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input 
                        id="name" 
                        placeholder="John Doe" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="email@example.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input 
                        id="password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSigningUp}>
                      {isSigningUp ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Account
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleGoogleSignIn}
                    disabled={isSigningUp}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Sign up with Google
                  </Button>
                  
                  {isDevelopment && (
                    <Button 
                      variant="secondary" 
                      className="w-full" 
                      onClick={handleDevLogin}
                    >
                      <BugPlay className="mr-2 h-4 w-4" />
                      Development Login
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Right side: Hero Section */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-primary/80 text-white items-center justify-center">
        <div className="max-w-lg px-8 space-y-6">
          <h1 className="text-4xl font-bold">Welcome to RepairTrack</h1>
          <p className="text-lg text-white/90">
            The complete repair shop management solution that helps you streamline your business.
          </p>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="bg-white/20 p-2 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M12 22s8-4 8-10V6l-8-4-8 4v6c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Secure and Reliable</h3>
                <p className="text-white/70 text-sm">Your data is safe with our secure cloud platform</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-white/20 p-2 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <path d="M12 11h4"></path>
                  <path d="M12 16h4"></path>
                  <path d="M8 11h.01"></path>
                  <path d="M8 16h.01"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Easy Inventory Management</h3>
                <p className="text-white/70 text-sm">Track parts, manage suppliers, and never run out of stock</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-white/20 p-2 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Team Collaboration</h3>
                <p className="text-white/70 text-sm">Manage technicians, assign tasks, and boost productivity</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;