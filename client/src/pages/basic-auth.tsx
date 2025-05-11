// This is a very simple standalone auth page with minimal dependencies
// Used for troubleshooting authentication issues

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

const BasicAuthPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('dev@example.com');
  const [password, setPassword] = useState('development');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Check if the API is accessible
  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        setMessage(`API Status: ${JSON.stringify(data)}`);
      } catch (error) {
        setMessage(`API Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    checkApi();
  }, []);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Use the development login endpoint
      const response = await fetch('/api/dev-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name: 'Development User'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Create a mock token for development
      const mockToken = 'dev-token-' + Date.now();
      localStorage.setItem('firebase_token', mockToken);
      localStorage.setItem('dev_mode', 'true');
      localStorage.setItem('dev_user', JSON.stringify({
        id: 'dev-user-123',
        email,
        displayName: 'Development User',
      }));
      
      setMessage(`Login successful! ${JSON.stringify(data)}`);
      
      // Redirect to home
      setTimeout(() => {
        setLocation('/');
      }, 1000);
    } catch (error) {
      setMessage(`Login error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{ 
      maxWidth: '500px', 
      margin: '50px auto', 
      padding: '20px', 
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)', 
      borderRadius: '8px',
      background: 'white'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>
        Basic Authentication Test
      </h1>
      
      <div style={{ 
        padding: '10px', 
        background: '#f5f5f5', 
        borderRadius: '4px', 
        marginBottom: '20px',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word'
      }}>
        {message || 'Checking API status...'}
      </div>
      
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Email:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            disabled={loading}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Password:
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            disabled={loading}
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            background: '#4f46e5', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Logging in...' : 'Login with Development Account'}
        </button>
      </form>
      
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <p>This is a simplified auth page for troubleshooting.</p>
        <p>Default credentials: dev@example.com / development</p>
      </div>
    </div>
  );
};

export default BasicAuthPage;