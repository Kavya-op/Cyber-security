/**
 * Rajasthan Police CDR/IPDR Intelligence Platform
 * Firebase Cloud Storage Service
 *
 * Securely stores raw CDR/IPDR forensic dumps and generated Section 65B
 * certified court PDF reports with case folder partitioning.
 */

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, isFirebaseConfigured } from './config';

/**
 * Upload raw CDR/IPDR carrier file to Firebase Storage
 */
export async function uploadRawForensicFile(file, caseId = 1, onProgress = null) {
  if (!isFirebaseConfigured() || !storage) {
    return {
      success: false,
      message: 'Firebase Storage not configured. File processed locally via backend.',
      localOnly: true,
    };
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `cases/case_${caseId}/raw_evidence/${timestamp}_${safeName}`;
  const storageRef = ref(storage, path);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      customMetadata: {
        caseId: String(caseId),
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        console.error('[Firebase Storage] Upload error:', error);
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          success: true,
          path,
          downloadURL,
          fileName: file.name,
        });
      }
    );
  });
}

/**
 * Store generated Section 65B PDF report in Firebase Storage
 */
export async function uploadCertifiedReport(pdfBlob, reportName, caseId = 1) {
  if (!isFirebaseConfigured() || !storage) {
    return {
      success: false,
      message: 'Firebase Storage offline. Report downloaded directly to investigator machine.',
    };
  }

  const path = `cases/case_${caseId}/certified_reports/${Date.now()}_${reportName}.pdf`;
  const storageRef = ref(storage, path);

  const snapshot = await uploadBytesResumable(storageRef, pdfBlob, {
    contentType: 'application/pdf',
    customMetadata: {
      caseId: String(caseId),
      certifiedUnder: 'Section 65B Indian Evidence Act',
    },
  });

  const downloadURL = await getDownloadURL(snapshot.ref);
  return {
    success: true,
    path,
    downloadURL,
  };
}
