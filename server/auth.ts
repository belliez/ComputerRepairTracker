import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { db } from './db';
import { users, organizations, organizationUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Initialize Firebase Admin once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

// Middleware to authenticate requests
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization header' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(403).json({ message: 'Failed to authenticate token' });
  }
};

// API endpoint to get current user
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Get the user from our database
    const userId = req.user.uid;
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      // Create the user if it doesn't exist
      const firebaseUser = await admin.auth().getUser(userId);
      
      const newUser = {
        id: userId,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || null,
        photoURL: firebaseUser.photoURL || null
      };
      
      // Insert into our users table
      const [createdUser] = await db.insert(users)
        .values(newUser)
        .returning();
      
      return res.json({ user: createdUser });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Error getting user:', error);
    return res.status(500).json({ message: 'Failed to get user' });
  }
};

// Create an organization
export const createOrganization = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const userId = req.user.uid;
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required' });
    }

    // Check if slug is already in use
    const existingOrg = await db.select()
      .from(organizations)
      .where(eq(organizations.slug, slug));

    if (existingOrg.length > 0) {
      return res.status(400).json({ message: 'That slug is already in use' });
    }

    // Create the organization
    const [organization] = await db.insert(organizations)
      .values({
        name,
        slug,
        ownerId: userId
      })
      .returning();

    // Add the creator as an admin
    await db.insert(organizationUsers)
      .values({
        organizationId: organization.id,
        userId,
        role: 'owner',
        inviteAccepted: true
      });

    return res.status(201).json(organization);
  } catch (error) {
    console.error('Error creating organization:', error);
    return res.status(500).json({ message: 'Failed to create organization' });
  }
};

// Get user's organizations
export const getUserOrganizations = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const userId = req.user.uid;

    // Get all organizations the user is a member of
    const result = await db.select({
      organization: organizations,
      role: organizationUsers.role
    })
      .from(organizationUsers)
      .innerJoin(organizations, eq(organizationUsers.organizationId, organizations.id))
      .where(eq(organizationUsers.userId, userId));

    // Format the response
    const userOrgs = result.map(({ organization, role }) => ({
      ...organization,
      role
    }));

    return res.json(userOrgs);
  } catch (error) {
    console.error('Error getting organizations:', error);
    return res.status(500).json({ message: 'Failed to get organizations' });
  }
};

// Add a user to an organization
export const addUserToOrganization = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { organizationId } = req.params;
    const { email, role } = req.body;

    if (!organizationId || !email || !role) {
      return res.status(400).json({ message: 'Organization ID, email, and role are required' });
    }

    // Check if the requesting user is an admin of the organization
    const orgMembership = await db.select()
      .from(organizationUsers)
      .where(eq(organizationUsers.organizationId, parseInt(organizationId)))
      .where(eq(organizationUsers.userId, req.user.uid));

    if (orgMembership.length === 0 || !['owner', 'admin'].includes(orgMembership[0].role)) {
      return res.status(403).json({ message: 'You do not have permission to add users to this organization' });
    }

    // Check if the user already exists in our system
    let userToAdd = await db.select()
      .from(users)
      .where(eq(users.email, email));

    // Add them to the organization
    const token = generateInviteToken();
    await db.insert(organizationUsers)
      .values({
        organizationId: parseInt(organizationId),
        userId: userToAdd[0]?.id || null,
        role,
        inviteAccepted: false,
        inviteEmail: email,
        inviteToken: token,
        inviteExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
      });

    // TODO: Send email invitation

    return res.status(201).json({ message: 'Invitation sent' });
  } catch (error) {
    console.error('Error adding user to organization:', error);
    return res.status(500).json({ message: 'Failed to add user' });
  }
};

// Accept an organization invitation
export const acceptOrganizationInvite = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Find the invitation
    const [invitation] = await db.select()
      .from(organizationUsers)
      .where(eq(organizationUsers.inviteToken, token));

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (invitation.inviteExpires && new Date(invitation.inviteExpires) < new Date()) {
      return res.status(400).json({ message: 'Invitation has expired' });
    }

    if (invitation.inviteAccepted) {
      return res.status(400).json({ message: 'Invitation has already been accepted' });
    }

    if (!req.user) {
      // Return info about the invitation so the frontend can show a login screen
      const [organization] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, invitation.organizationId));

      return res.json({
        organization,
        email: invitation.inviteEmail
      });
    }

    // User is logged in, accept the invitation
    const userId = req.user.uid;

    // Update the invitation
    await db.update(organizationUsers)
      .set({
        userId,
        inviteAccepted: true,
        updatedAt: new Date()
      })
      .where(eq(organizationUsers.inviteToken, token));

    return res.json({ message: 'Invitation accepted' });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return res.status(500).json({ message: 'Failed to accept invitation' });
  }
};

// Helper function to generate a random token
function generateInviteToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Add organization context to all routes
export const addOrganizationContext = async (req: Request, res: Response, next: NextFunction) => {
  // Skip if not authenticated or if path is in the exclusion list
  const exclusionPaths = ['/api/user', '/api/organizations', '/api/auth'];
  if (!req.user || exclusionPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Get the organization ID from the query params, headers, or the first org the user is a member of
  const organizationId = req.query.organizationId || req.headers['x-organization-id'];
  
  if (!organizationId) {
    // Get the first organization the user is a member of
    const memberships = await db.select()
      .from(organizationUsers)
      .where(eq(organizationUsers.userId, req.user.uid))
      .limit(1);
    
    if (memberships.length === 0) {
      return res.status(400).json({ message: 'No organization specified and user is not a member of any organization' });
    }
    
    req.organizationId = memberships[0].organizationId;
  } else {
    req.organizationId = parseInt(organizationId as string);
    
    // Verify the user has access to this organization
    const membership = await db.select()
      .from(organizationUsers)
      .where(eq(organizationUsers.organizationId, req.organizationId))
      .where(eq(organizationUsers.userId, req.user.uid));
    
    if (membership.length === 0) {
      return res.status(403).json({ message: 'You do not have access to this organization' });
    }
  }
  
  next();
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken;
      organizationId?: number;
    }
  }
}