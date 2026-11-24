/**
 * Rajasthan Police CDR/IPDR Intelligence Platform
 * Firebase Authentication Service
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './config';

/**
 * Determines officer role and badge number from user profile or email
 */
export function deriveOfficerProfile(user) {
  if (!user) return null;

  const email = (user.email || '').toLowerCase();
  const displayName = user.displayName || email.split('@')[0] || 'Investigating Officer';

  let role = 'Senior Investigator';
  let badgeId = 'RJ-POL-8821';

  if (email.includes('admin') || email.includes('sp') || email.includes('adm')) {
    role = 'Admin';
    badgeId = 'RJ-ADM-0102';
  } else if (email.includes('cyber') || email.includes('analyst') || email.includes('forensic') || email.includes('cyb')) {
    role = 'Cyber Analyst';
    badgeId = 'RJ-CYB-4091';
  } else {
    role = 'Senior Investigator';
    badgeId = 'RJ-POL-8821';
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName,
    role,
    badgeId,
    photoURL: user.photoURL,
  };
}

/**
 * Sign in officer using official email and password
 */
export async function signInOfficerWithEmail(email, password) {
  if (!isFirebaseConfigured() || !auth) {
    throw new Error('Firebase credentials not configured in .env. Please configure VITE_FIREBASE_API_KEY or use 1-click Demo Login.');
  }
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return deriveOfficerProfile(credential.user);
}

/**
 * Register a new officer in Firebase Auth
 */
export async function registerOfficerWithEmail(email, password, displayName, role = 'Senior Investigator') {
  if (!isFirebaseConfigured() || !auth) {
    throw new Error('Firebase credentials not configured in .env.');
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  return deriveOfficerProfile(credential.user);
}

/**
 * Sign in officer using Google SSO (e.g. police.rajasthan.gov.in)
 */
export async function signInOfficerWithGoogle() {
  if (!isFirebaseConfigured() || !auth || !googleProvider) {
    throw new Error('Firebase credentials not configured in .env. Please configure VITE_FIREBASE_API_KEY or use 1-click Demo Login.');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return deriveOfficerProfile(result.user);
}

/**
 * Sign out current officer
 */
export async function signOutOfficer() {
  if (auth) {
    await signOut(auth);
  }
}

/**
 * Listen to real-time auth state changes
 */
export function subscribeToAuthChanges(callback) {
  if (!isFirebaseConfigured() || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    callback(deriveOfficerProfile(user));
  });
}
