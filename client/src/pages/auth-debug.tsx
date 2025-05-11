import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const AuthDebugPage = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<string>('Checking status...');
  const [localStorageItems, setLocalStorageItems] = useState<Record<string, string>>({});
  const [email, setEmail] = useState<string>('dev@example.com');
  const [apiResult, setApiResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [directRoute, setDirectRoute] = useState<string>('/api/me');

  // Helper to update local storage display
  const updateLocalStorageDisplay = () => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        items[key] = value;
      }
    }
    setLocalStorageItems(items);
  };

  // Load initial state
  useEffect(() => {
    checkStatus();
    updateLocalStorageDisplay();
  }, []);

  // Check API status
  const checkStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setStatus(JSON.stringify(data, null, 2));
    } catch (error) {
      setStatus(`Error checking status: ${(error as Error).message}`);
    }
  };

  // Login with development credentials
  const login = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: 'Development User' })
      });
      
      if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store authentication data
      const token = data.token || `dev-token-${Date.now()}`;
      localStorage.setItem('firebase_token', token);
      localStorage.setItem('dev_mode', 'true');
      localStorage.setItem('dev_user', JSON.stringify({
        id: 'dev-user-123',
        email,
        displayName: 'Development User',
      }));
      
      setApiResult(JSON.stringify(data, null, 2));
      updateLocalStorageDisplay();
      
      toast({
        title: 'Login Successful',
        description: 'Development credentials have been set.',
      });
    } catch (error) {
      setApiResult(`Error logging in: ${(error as Error).message}`);
      toast({
        title: 'Login Failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test API endpoint with direct fetch
  const testDirectFetch = async () => {
    setIsLoading(true);
    try {
      // Get current token
      const token = localStorage.getItem('firebase_token');
      
      // Setup request
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(directRoute, {
        headers,
        credentials: 'include'
      });
      
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      setApiResult(
        `Status: ${response.status}\n` +
        `Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}\n` +
        `Data: ${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`
      );
    } catch (error) {
      setApiResult(`Error fetching ${directRoute}: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear local storage
  const clearStorage = () => {
    localStorage.clear();
    updateLocalStorageDisplay();
    toast({
      title: 'Storage Cleared',
      description: 'All localStorage items have been removed.',
    });
  };

  return (
    <div className="container py-8 flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Authentication Debugging</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current API status</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-100 p-4 rounded text-sm overflow-auto max-h-40">
              {status}
            </pre>
          </CardContent>
          <CardFooter>
            <Button onClick={checkStatus}>Refresh Status</Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Local Storage</CardTitle>
            <CardDescription>Current browser storage state</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-100 p-4 rounded text-sm overflow-auto max-h-40">
              {JSON.stringify(localStorageItems, null, 2)}
            </pre>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button onClick={updateLocalStorageDisplay}>Refresh</Button>
            <Button variant="destructive" onClick={clearStorage}>Clear All</Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Development Login</CardTitle>
            <CardDescription>Create mock auth session for development</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={login} disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login with Dev Account'}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Test API Endpoint</CardTitle>
            <CardDescription>Test a direct API call with authentication</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiRoute">API Route</Label>
                <Input
                  id="apiRoute"
                  value={directRoute}
                  onChange={(e) => setDirectRoute(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Result</Label>
                <pre className="bg-slate-100 p-4 rounded text-sm overflow-auto max-h-40">
                  {apiResult || 'No result yet'}
                </pre>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={testDirectFetch} disabled={isLoading}>
              {isLoading ? 'Testing...' : 'Test API Call'}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Navigation</CardTitle>
          <CardDescription>Go to other pages</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={() => window.location.href = '/'}>Go to Main App</Button>
          <Button onClick={() => window.location.href = '/simple-auth'}>Go to Simple Auth</Button>
          <Button onClick={() => window.location.href = '/auth'}>Go to Auth Page</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthDebugPage;