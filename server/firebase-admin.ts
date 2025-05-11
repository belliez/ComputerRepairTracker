import { readFileSync } from 'fs';
import { join } from 'path';
import admin from 'firebase-admin';
import { App } from 'firebase-admin/app';
import { Auth } from 'firebase-admin/auth';

// Setup and initialize Firebase Admin SDK
let firebaseApp: App | null = null;
let firebaseAuth: Auth | null = null;

// Function to get a Firebase Admin instance, creating one if it doesn't exist
export function getFirebaseAdmin(): App {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Check for environment variables first
    if (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
          privateKey: privateKey,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '',
        }),
      });
      
      console.log('Firebase Admin SDK initialized with environment variables');
      return firebaseApp;
    } else {
      try {
        // Fallback to service account file if environment variables aren't available
        const serviceAccountPath = join(process.cwd(), 'attached_assets', 'repairtrackerpro-eba5d-firebase-adminsdk-fbsvc-aa4e33f894.json');
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
        
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        
        console.log('Firebase Admin SDK initialized with service account file');
        return firebaseApp;
      } catch (fileError) {
        console.error('Error reading service account file:', fileError);
        throw new Error('Failed to read service account file and no environment variables were provided');
      }
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
}

// Export the auth service for convenience
export function getAdminAuth(): admin.auth.Auth | null {
  try {
    if (!firebaseApp) {
      firebaseApp = getFirebaseAdmin();
    }
    
    if (!firebaseAuth) {
      firebaseAuth = admin.auth(firebaseApp) as unknown as Auth;
    }
    
    return firebaseAuth as admin.auth.Auth;
  } catch (error) {
    console.warn('Could not get Firebase Admin Auth service:', error);
    return null;
  }
}