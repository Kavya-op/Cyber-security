/**
 * Rajasthan Police CDR/IPDR Intelligence Platform
 * Cloud Firestore Real-Time Synchronization Service
 *
 * Keeps forensic audit logs, case dossiers, and suspect notes synchronized
 * across all connected officer workstations in real time.
 */

import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';

const AUDIT_COLLECTION = 'forensic_audit_trail';
const CASES_COLLECTION = 'investigation_cases';
const NOTES_COLLECTION = 'suspect_dossier_notes';

/**
 * Log a Section 65B tamper-evident audit action to Cloud Firestore
 */
export async function logAuditAction(actionPayload) {
  if (!isFirebaseConfigured() || !db) {
    return null;
  }
  try {
    const colRef = collection(db, AUDIT_COLLECTION);
    const docRef = await addDoc(colRef, {
      ...actionPayload,
      serverTime: serverTimestamp(),
      created_at: new Date().toISOString(),
      platform: 'Rajasthan Police Intelligence Portal v2.0',
    });
    return docRef.id;
  } catch (err) {
    console.error('[Firestore] Error logging audit action:', err);
    return null;
  }
}

/**
 * Subscribe to real-time audit log stream from Firestore
 */
export function subscribeToAuditLogs(onUpdate) {
  if (!isFirebaseConfigured() || !db) {
    return () => {};
  }
  try {
    const q = query(collection(db, AUDIT_COLLECTION), orderBy('created_at', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snapshot) => {
        const logs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        if (logs.length > 0) {
          onUpdate(logs);
        }
      },
      (error) => {
        console.warn('[Firestore] Audit log subscription warning:', error);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Error setting up audit subscription:', err);
    return () => {};
  }
}

/**
 * Save or update case dossier snapshot in Firestore
 */
export async function syncCaseDossier(caseId, caseData) {
  if (!isFirebaseConfigured() || !db) return null;
  try {
    const docRef = doc(db, CASES_COLLECTION, String(caseId));
    await setDoc(
      docRef,
      {
        ...caseData,
        last_updated: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('[Firestore] Error saving case dossier:', err);
    return false;
  }
}

/**
 * Save suspect note in real-time collaboration collection
 */
export async function addSuspectNote(caseId, suspectNumber, noteText, officerBadge) {
  if (!isFirebaseConfigured() || !db) return null;
  try {
    const colRef = collection(db, NOTES_COLLECTION);
    const docRef = await addDoc(colRef, {
      case_id: Number(caseId),
      suspect_number: suspectNumber,
      note_text: noteText,
      officer_badge: officerBadge,
      created_at: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.error('[Firestore] Error adding suspect note:', err);
    return null;
  }
}
