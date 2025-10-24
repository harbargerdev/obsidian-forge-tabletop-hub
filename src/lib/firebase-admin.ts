
import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// IMPORTANT: This file should not be included in client-side code.
// It is intended for server-side use only (e.g., in Next.js API routes).

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

if (!getApps().length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // This will use the default service account in GCP environments
    // and will fail in local development if FIREBASE_SERVICE_ACCOUNT is not set.
    console.warn("FIREBASE_SERVICE_ACCOUNT environment variable not set. Initializing app with default credentials. This will only work in a GCP environment.");
    admin.initializeApp();
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
