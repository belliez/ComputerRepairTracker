import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Use environment variables when available
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log("Firebase client initialized with project:", firebaseConfig.projectId);
} catch (error) {
  console.error("Error initializing Firebase client:", error);
}

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app;