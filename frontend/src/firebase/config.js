/**
 * Rajasthan Police CDR/IPDR Intelligence Platform
 * Firebase Client SDK Configuration
 *
 * Configures Firebase Auth, Cloud Firestore, and Cloud Storage.
 * Supports graceful fallback to local forensic simulation mode when
 * live environment credentials are not yet supplied.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if valid credentials are provided
export const isFirebaseConfigured = () => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== 'YOUR_FIREBASE_PROJECT_ID'
  );
};

let app = null;
let auth = null;
let db = null;
let storage = null;
let googleProvider = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    console.info('[Firebase] Initialized live connection to project:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('[Firebase] Initialization error; falling back to offline forensic mode:', err);
  }
} else {
  console.info('[Firebase] Environment keys not set. Operating in Offline Forensic Mode with demo credentials.');
}

export { app, auth, db, storage, googleProvider, firebaseConfig };
