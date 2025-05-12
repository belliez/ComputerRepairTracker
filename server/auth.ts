import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { db } from './db';
import { users, organizations, organizationUsers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getFirebaseAdmin, getAdminAuth } from './firebase-admin';

// Flag to indicate if Firebase Admin SDK is initialized
let firebaseInitialized = false;

try {
  // Try to initialize the Firebase Admin SDK
  getFirebaseAdmin();
  firebaseInitialized = true;
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  console.log('Continuing in development mode without Firebase authentication');
}

// Types for our development user
interface MockDecodedIdToken {
  uid: string;
  email: string;
  name: string;
  displayName?: string; // Add displayName to match Firebase user structure
  iat: number;
  exp: number;
  aud: string;
  iss: string;
  sub: string;
  auth_time: number;
  // Add necessary firebase field properties
  firebase: {
    sign_in_provider: string;
    identities: Record<string, any>;
  };
}

// Middleware to authenticate JWT tokens from Firebase
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  // Log the full URL and path for debugging
  console.log(`AUTH DEBUG: Request URL: ${req.url}, Path: ${req.path}, BaseURL: ${req.baseUrl}, OriginalURL: ${req.originalUrl}`);
  
  // Check for debug headers
  const debugClient = req.headers['x-debug-client'];
  const debugMode = req.headers['x-debug-mode'] === 'true';
  
  if (debugClient) {
    console.log(`DEBUG: Client debug header detected: ${debugClient}`);
  }
  
  if (debugMode) {
    console.log(`DEBUG: Debug mode header detected, will use enhanced error handling`);
  }
  
  // DEBUGGING: Check if we're accessing settings endpoints and bypass auth
  if (req.originalUrl.includes('/settings/currencies') || 
      req.originalUrl.includes('/settings/tax-rates') || 
      req.originalUrl.includes('/technicians') ||
      req.originalUrl.includes('/public-settings')) {
    console.log(`DEBUG: Bypassing authentication for settings endpoint: ${req.originalUrl}`);
    
    // Create a mock user for debugging settings
    const debugUser: MockDecodedIdToken = {
      uid: 'debug-user-123',
      email: 'debug@example.com',
      name: 'Debug User',
      displayName: 'Debug User',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: 'debug-audience',
      iss: 'debug-issuer',
      sub: 'debug-subject',
      auth_time: Math.floor(Date.now() / 1000),
      firebase: { 
        sign_in_provider: 'debug',
        identities: {}
      }
    };
    
    // Set the debug user but don't force organization ID for settings
    req.user = debugUser as any;
    
    // Only set the organization ID if not already determined from the user's session
    if (!req.organizationId) {
      // For the development user (dev@example.com), use organization ID 1
      // otherwise, use organization ID 2 for the Laptop Fixers organization
      if (req.originalUrl.includes('dev-login') || 
          (req.body && req.body.username === 'dev@example.com')) {
        req.organizationId = 1;
        (global as any).currentOrganizationId = 1;
        console.log('Setting global organization context to 1 for development user');
      } else {
        req.organizationId = 2;
        (global as any).currentOrganizationId = 2;
        console.log('Setting global organization context to 2 for settings request');
      }
    }
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  // Check for dev token in development mode
  if (process.env.NODE_ENV === 'development') {
    // Check if the token is a development token
    if (authHeader && authHeader.startsWith('Bearer dev-token-')) {
      console.log('Development token detected, using mock user');
      
      // Create a comprehensive mock user for development purposes
      const mockUser: MockDecodedIdToken = {
        uid: 'dev-user-123',
        email: 'dev@example.com',
        name: 'Development User',
        displayName: 'Development User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // Token valid for 1 hour
        aud: 'dev-audience',
        iss: 'dev-issuer',
        sub: 'dev-subject',
        auth_time: Math.floor(Date.now() / 1000),
        firebase: { 
          sign_in_provider: 'development',
          identities: {}
        }
      };
      
      // Cast to any to avoid type issues since we're in development mode only
      req.user = mockUser as any;
      
      // Always set the organization context to org ID 1 for the dev user
      req.organizationId = 1;
      (global as any).currentOrganizationId = 1;
      console.log('Development token detected - setting organization ID to 1');
      
      return next();
    }
    
    // If Firebase isn't initialized in development, allow the request with a mock user
    if (!firebaseInitialized) {
      console.warn('Firebase Admin SDK not initialized, bypassing authentication in development');
      // Create a comprehensive mock user for development purposes
      const mockUser: MockDecodedIdToken = {
        uid: 'dev-user-123',
        email: 'dev@example.com',
        name: 'Development User',
        displayName: 'Development User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // Token valid for 1 hour
        aud: 'dev-audience',
        iss: 'dev-issuer',
        sub: 'dev-subject',
        auth_time: Math.floor(Date.now() / 1000),
        firebase: { 
          sign_in_provider: 'development',
          identities: {}
        }
      };
      // Cast to any to avoid type issues since we're in development mode only
      req.user = mockUser as any;
      
      // Always set the organization context to org ID 1 for the dev user
      req.organizationId = 1;
      (global as any).currentOrganizationId = 1;
      console.log('Development mode - setting organization ID to 1');
      
      return next();
    }
  }

  // For production or non-dev tokens, require proper authorization
  // Special handling for the main app route in development
  if (process.env.NODE_ENV === 'development' && (
      req.path === '/' || 
      req.path.startsWith('/assets') || 
      req.path.startsWith('/src') || 
      req.path.startsWith('/@') || 
      req.path.startsWith('/@vite') || 
      req.path.startsWith('/@fs') ||
      req.path.endsWith('.js') ||
      req.path.endsWith('.css') ||
      req.path.endsWith('.svg') ||
      req.path.endsWith('.png')
    )) {
    // In development, allow access to these paths without authentication
    console.log('Bypassing auth for development frontend paths:', req.path);
    return next();
  }
  
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header required' });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Bearer token required' });
  }
  
  try {
    const auth = getAdminAuth();
    
    if (!auth) {
      console.warn('Firebase Admin Auth service not available, bypassing authentication in development');
      return next();
    }
    
    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = decodedToken;
      
      // Check if user exists in our database, create if not
      const [existingUser] = await db.select().from(users).where(eq(users.id, decodedToken.uid));
      
      if (!existingUser) {
        // Get user details from Firebase
        const userRecord = await auth.getUser(decodedToken.uid);
        
        // Create user in our database
        await db.insert(users).values({
          id: userRecord.uid,
          email: userRecord.email || '',
          displayName: userRecord.displayName || null,
          photoURL: userRecord.photoURL || null,
          lastLoginAt: new Date(),
        });
      } else {
        // Update last login time
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, decodedToken.uid));
      }
      
      next();
    } catch (tokenError: any) {
      // Check if the token is expired
      if (tokenError.code === 'auth/id-token-expired') {
        console.error('Firebase token expired');
        return res.status(401).json({ 
          message: 'Authentication token expired', 
          code: 'token_expired',
          error: tokenError.message 
        });
      }
      
      // Check if the token is revoked
      if (tokenError.code === 'auth/id-token-revoked') {
        console.error('Firebase token revoked');
        return res.status(401).json({ 
          message: 'Authentication token revoked', 
          code: 'token_revoked',
          error: tokenError.message 
        });
      }
      
      throw tokenError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    console.error('Authentication error:', error);
    
    // Return structured error response
    return res.status(403).json({ 
      message: 'Authentication failed',
      error: error.message || 'Unknown error',
      code: error.code || 'unknown_error'
    });
  }
};

// API endpoint to get current user
export const getCurrentUser = async (req: Request, res: Response) => {
  // Special handling for development mode
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'development' && authHeader && authHeader.startsWith('Bearer dev-token-')) {
    console.log('Development token detected in /api/me, returning mock user');
    
    // Return a complete mock user for development
    const mockUser = {
      id: 'dev-user-123',
      email: 'dev@example.com',
      displayName: 'Development User',
      photoURL: null,
      lastLoginAt: new Date().toISOString(),
      organization: {
        id: 1,
        name: 'Development Organization',
        slug: 'dev-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'dev-user-123',
        logo: null,
        stripeSubscriptionId: 'mock_sub_123',
        subscriptionStatus: 'active',
        trialEndsAt: null,
        planId: 'free',
        billingEmail: 'dev@example.com',
        billingName: 'Development User',
        billingAddress: null,
        deleted: false,
        deletedAt: null,
        role: 'owner'
      }
    };
    
    return res.status(200).json(mockUser);
  }
  
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Not authenticated',
      code: 'not_authenticated'
    });
  }
  
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.uid));
    
    if (!user) {
      // If user exists in Firebase but not in our database, we create them
      try {
        const auth = getAdminAuth();
        if (!auth) {
          return res.status(500).json({ 
            message: 'Auth service unavailable',
            code: 'auth_service_unavailable'
          });
        }
        
        // Get user details from Firebase
        const userRecord = await auth.getUser(req.user.uid);
        
        // Create user in our database
        const [newUser] = await db.insert(users).values({
          id: userRecord.uid,
          email: userRecord.email || '',
          displayName: userRecord.displayName || null,
          photoURL: userRecord.photoURL || null,
          lastLoginAt: new Date(),
        }).returning();
        
        return res.json(newUser);
      } catch (error) {
        console.error('Error creating user:', error);
        return res.status(404).json({ 
          message: 'User not found and could not be created', 
          code: 'user_creation_failed' 
        });
      }
    }
    
    // Include auth metadata
    const enhancedUser = {
      ...user,
      // Add Firebase auth fields that might be useful for the client
      firebaseAuth: {
        emailVerified: req.user.email_verified || false,
        provider: req.user.firebase?.sign_in_provider || null,
      }
    };
    
    res.json(enhancedUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      message: 'Server error fetching user data',
      code: 'server_error'
    });
  }
};

// API endpoint to create organization
export const createOrganization = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ message: 'Organization name is required' });
  }
  
  try {
    // Generate a URL-friendly slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + 
      '-' + 
      nanoid(5).toLowerCase();
    
    // Create the organization
    const [organization] = await db
      .insert(organizations)
      .values({
        name,
        slug,
        ownerId: req.user.uid,
      })
      .returning();
    
    // Add the user as the owner
    await db
      .insert(organizationUsers)
      .values({
        organizationId: organization.id,
        userId: req.user.uid,
        role: 'owner',
        inviteAccepted: true,
      });
    
    res.status(201).json(organization);
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// API endpoint to get user organizations
export const getUserOrganizations = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  try {
    // Get all organization memberships for the user
    const orgUsers = await db
      .select()
      .from(organizationUsers)
      .where(eq(organizationUsers.userId, req.user.uid));
    
    // Get all organizations that the user is a member of
    const orgIds = orgUsers.map((ou) => ou.organizationId);
    
    if (orgIds.length === 0) {
      return res.json([]);
    }
    
    const orgs = await db
      .select()
      .from(organizations)
      .where(
        eq(organizations.deleted, false)
      );
    
    // Combine the data to include role information
    const orgsWithRole = orgs
      .filter(org => orgIds.includes(org.id))
      .map((org) => {
        const membership = orgUsers.find((ou) => ou.organizationId === org.id);
        
        // Log organization data for debugging
        console.log('Organization data being sent to client:', JSON.stringify({
          id: org.id,
          name: org.name,
          settings: org.settings
        }, null, 2));
        
        return {
          ...org,
          role: membership ? membership.role : 'member',
        };
      });
    
    res.json(orgsWithRole);
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// API endpoint to add a user to an organization
export const addUserToOrganization = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const { organizationId, email, role } = req.body;
  
  if (!organizationId || !email) {
    return res.status(400).json({ message: 'Organization ID and email are required' });
  }
  
  try {
    // Check if the current user is an admin or owner of the organization
    const [userOrg] = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.organizationId, organizationId),
          eq(organizationUsers.userId, req.user.uid)
        )
      );
    
    if (!userOrg || (userOrg.role !== 'owner' && userOrg.role !== 'admin')) {
      return res.status(403).json({ message: 'You do not have permission to add users to this organization' });
    }
    
    // Check if user exists
    let existingUser;
    try {
      const auth = getAdminAuth();
      if (auth) {
        existingUser = await auth.getUserByEmail(email);
      }
    } catch (error) {
      // User doesn't exist in Firebase
    }
    
    // Generate an invite token
    const inviteToken = generateInviteToken();
    const inviteExpires = new Date();
    inviteExpires.setDate(inviteExpires.getDate() + 7); // Expires in 7 days
    
    // Add the user to the organization
    if (existingUser) {
      // If user exists, add with userId
      await db
        .insert(organizationUsers)
        .values({
          organizationId,
          userId: existingUser.uid,
          role: role || 'member',
          inviteEmail: email,
          inviteToken,
          inviteExpires,
          inviteAccepted: false,
        });
    } else {
      // If user doesn't exist, create an entry without userId (will be filled when they accept)
      // Create with a placeholder userId as required by the schema
      await db
        .insert(organizationUsers)
        .values({
          organizationId,
          // Use a placeholder that will be updated when invitation is accepted
          userId: 'pending-' + nanoid(10),
          role: role || 'member',
          inviteEmail: email,
          inviteToken,
          inviteExpires,
          inviteAccepted: false,
        });
    }
    
    // TODO: Send invitation email
    
    res.status(201).json({ message: 'Invitation sent' });
  } catch (error) {
    console.error('Error adding user to organization:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// API endpoint to accept an organization invite
export const acceptOrganizationInvite = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ message: 'Invite token is required' });
  }
  
  try {
    // Find the invitation
    const [invite] = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.inviteToken, token),
          eq(organizationUsers.inviteAccepted, false)
        )
      );
    
    if (!invite) {
      return res.status(404).json({ message: 'Invitation not found or already accepted' });
    }
    
    // Check if invitation is expired
    if (invite.inviteExpires && invite.inviteExpires < new Date()) {
      return res.status(400).json({ message: 'Invitation has expired' });
    }
    
    // Check if the email matches
    const userEmail = req.user.email;
    if (!userEmail) {
      return res.status(400).json({ message: 'Your account does not have an email address' });
    }
    
    if (!invite.inviteEmail) {
      return res.status(400).json({ message: 'Invalid invitation: no email associated' });
    }
    
    if (invite.inviteEmail.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ message: 'This invitation was not sent to your email address' });
    }
    
    // Update the invitation
    await db
      .update(organizationUsers)
      .set({
        userId: req.user.uid,
        inviteAccepted: true,
        inviteToken: null,
        inviteExpires: null,
      })
      .where(eq(organizationUsers.id, invite.id));
    
    // Get the organization details
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, invite.organizationId));
    
    res.json({
      message: 'Invitation accepted',
      organization,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to generate a random token
function generateInviteToken() {
  return nanoid(32);
}

// Middleware to add organization context
export const addOrganizationContext = async (req: Request, res: Response, next: NextFunction) => {
  // Check for debug headers
  const debugClient = req.headers['x-debug-client'];
  const debugMode = req.headers['x-debug-mode'] === 'true';

  // Debug logging
  console.log(`Processing request to ${req.path}, auth header: ${req.headers.authorization ? 'present' : 'absent'}, user: ${req.user ? 'authenticated' : 'unauthenticated'}, debug mode: ${debugMode ? 'enabled' : 'disabled'}`);

  try {  
    // IMPORTANT: Don't automatically set organization ID to 1
    // This was the source of the multi-tenant issues
    
    // Special handling for development tokens
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer dev-token-')) {
      console.log('Development token detected, using mock user');
      
      if (!req.user && req.path.includes('/api/')) {
        req.user = {
          uid: 'dev-user-123',
          email: 'dev@example.com',
          name: 'Development User',
        } as any;
      }
      
      // Check if organization ID is specified in headers
      const orgIdHeader = req.headers['x-organization-id'];
      const orgId = orgIdHeader ? parseInt(orgIdHeader as string) : 1;
      
      // Set organization ID from header or default to 1
      req.organizationId = orgId;
      (global as any).currentOrganizationId = orgId;
      console.log(`Development token detected - setting organization ID to ${orgId}`);
      
      // Log all headers to debug
      console.log('All request headers:', JSON.stringify(req.headers));
      
      return next();
    }
    
    // Development mode special handling for API paths
    if (process.env.NODE_ENV === 'development' && (
      req.path.includes('/api/settings/') || 
      req.path.includes('/api/organizations') || 
      req.path.includes('/public-settings') ||
      req.path.includes('/api/customers') ||
      req.path.includes('/api/devices') ||
      req.path.includes('/api/repairs') ||
      req.path.includes('/api/technicians') ||
      req.path.includes('/api/inventory')
    )) {
      if (!req.user) {
        console.log('Development mode API request, using mock user');
        req.user = {
          uid: 'dev-user-123',
          email: 'dev@example.com',
          name: 'Development User',
        } as any;
      }
      
      // Only set organization ID if not already set
      if (!req.organizationId) {
        req.organizationId = 2;
        (global as any).currentOrganizationId = 2;
        console.log('Setting development API organization ID to 2');
      }
      
      return next();
    }
    
    // Skip organization context if no user is authenticated
    if (!req.user) {
      console.log(`No user found for request to ${req.path}, skipping organization context`);
      return next();
    }
    
    // If the organization ID is provided in the request body, query or headers
    const requestedOrgId = req.body?.organizationId || req.query?.organizationId || req.headers['x-organization-id'];
    
    // Check if the user has any organizations first
    const userOrgs = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.userId, req.user.uid),
          eq(organizationUsers.inviteAccepted, true)
        )
      );
    
    // If the user is trying to create an organization and has none, allow it
    if (req.path === '/api/settings/organization' && req.method === 'POST' && userOrgs.length === 0) {
      console.log('User is creating their first organization, bypassing organization context check');
      console.log('Received data:', JSON.stringify(req.body, null, 2));
      
      // Special handling for onboarding - company info is passed as { type: 'company', name: '...', ... }
      // or directly in the body depending on the endpoint usage
      let organizationName = '';
      
      if (req.body?.type === 'company') {
        organizationName = req.body.name;
        console.log('Detected onboarding company setup with name:', organizationName);
      } else if (req.body?.name) {
        organizationName = req.body.name;
        console.log('Detected direct organization creation with name:', organizationName);
      } else {
        // If no name is provided, use a default one
        organizationName = `${req.user.email || 'New'}'s Repair Shop`;
        console.log('Using default organization name:', organizationName);
      }
      
      if (organizationName) {
        try {
          console.log('Creating new organization with name:', organizationName);
          
          // Insert the new organization
          const [newOrg] = await db
            .insert(organizations)
            .values({
              name: organizationName,
              slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
              ownerId: req.user.uid,
              settings: req.body.settings || {}
            })
            .returning();
          
          // Link the user to the organization
          await db
            .insert(organizationUsers)
            .values({
              userId: req.user.uid,
              organizationId: newOrg.id,
              role: 'owner',
              inviteAccepted: true
            });
          
          console.log(`Created new organization '${newOrg.name}' with ID ${newOrg.id} for user ${req.user.uid}`);
          
          // Set the context to the new organization
          req.organizationId = newOrg.id;
          (global as any).currentOrganizationId = newOrg.id;
          console.log(`Setting organization context to new organization ${newOrg.id}`);
          
          return next();
        } catch (error) {
          console.error('Error creating new organization:', error);
        }
      } else {
        console.error('No organization name provided for organization creation');
      }
    }
    
    // For normal requests, validate organization membership
    if (requestedOrgId) {
      try {
        // Check if the user is a member of this organization
        const [userOrg] = await db
          .select()
          .from(organizationUsers)
          .where(
            and(
              eq(organizationUsers.organizationId, Number(requestedOrgId)),
              eq(organizationUsers.userId, req.user.uid),
              eq(organizationUsers.inviteAccepted, true)
            )
          );
        
        if (userOrg) {
          const orgId = Number(requestedOrgId);
          req.organizationId = orgId;
          (global as any).currentOrganizationId = orgId;
          console.log(`Setting global organization context to ${orgId} from user membership`);
        } else {
          console.log(`User ${req.user.uid} not a member of organization ${requestedOrgId}`);
        }
      } catch (error) {
        console.error('Error checking organization membership:', error);
      }
    }
  } catch (error) {
    console.error('Error in organization context middleware:', error);
    
    // Fallback to organization ID 2 in case of error in development mode
    if (process.env.NODE_ENV === 'development') {
      req.organizationId = 2;
      (global as any).currentOrganizationId = 2;
      console.log('Using fallback organization ID 2 due to error');
    }
    
    return next();
  }
  
  next();
};

// Extend the Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken;
      organizationId?: number;
    }
  }
}