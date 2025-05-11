import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Use Vite environment variables with type declaration
// This helps TypeScript recognize the properties
declare global {
  interface ImportMeta {
    env: {
      VITE_FIREBASE_API_KEY?: string;
      VITE_FIREBASE_PROJECT_ID?: string;
      VITE_FIREBASE_APP_ID?: string;
    };
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
let app;
try {
  // Check if we have the required configuration
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.warn("Firebase configuration is incomplete. Missing required values:", {
      apiKey: !!firebaseConfig.apiKey,
      projectId: !!firebaseConfig.projectId,
      appId: !!firebaseConfig.appId
    });
  }
  
  app = initializeApp(firebaseConfig);
  console.log("Firebase client initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase client:", error);
}

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app;