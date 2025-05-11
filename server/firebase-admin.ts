import * as admin from 'firebase-admin';

// Setup and initialize Firebase Admin SDK
let firebaseAdmin: admin.app.App;

// Function to get a Firebase Admin instance, creating one if it doesn't exist
export function getFirebaseAdmin(): admin.app.App {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  try {
    // Check for environment variables first
    if (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID,
          privateKey: privateKey,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        }),
      });
      
      console.log('Firebase Admin SDK initialized with environment variables');
      return firebaseAdmin;
    } else {
      // Fallback to service account file if environment variables aren't available
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(require('../attached_assets/repairtrackerpro-eba5d-firebase-adminsdk-fbsvc-aa4e33f894.json')),
      });
      
      console.log('Firebase Admin SDK initialized with service account file');
      return firebaseAdmin;
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
}

// Export the auth service for convenience
export function getAdminAuth(): admin.auth.Auth {
  return getFirebaseAdmin().auth();
}