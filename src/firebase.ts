import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * Firebase initialization configured for production and APK environments.
 * The authDomain is explicitly derived from the projectId to ensure
 * authorized domains are correctly targeted during the handshake.
 */
const extendedConfig = {
  ...firebaseConfig,
  authDomain: `${firebaseConfig.projectId}.firebaseapp.com`
};

// Singleton pattern for app initialization to prevent multi-instance errors
const app = !getApps().length ? initializeApp(extendedConfig) : getApp();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
