
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging } from 'firebase/messaging';
// ← Add Messaging imports


// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDuWyFzPQGpgw8-WKMPjnHBfTTgFXe1ZkQ",
  authDomain: "meetu-23587.firebaseapp.com",
  projectId: "meetu-23587",
  storageBucket: "meetu-23587.appspot.com",
  messagingSenderId: "329099428437",
  appId: "1:329099428437:web:e8aa7f69cbfb22f1c1bcdc",
  measurementId: "G-8BVL7NC3MV",
  databaseURL: "https://meetudatabutton-default-rtdb.europe-west1.firebasedatabase.app"
};

//
// ────────────────────────────────────────────────────────────────────────────
//   STEP 2: initializeFirebase() that returns each service instance
// ────────────────────────────────────────────────────────────────────────────
//
const initializeFirebase = () => {
  try {
    console.log(
      '%c🔥 INITIALIZING FIREBASE SERVICES',
      'background: #FFA000; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;'
    );

    // Initialize the Firebase app if it hasn't been initialized yet
    const app: FirebaseApp =
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

    // Initialize Firestore
    const firestore: Firestore = getFirestore(app);
    console.log('%c✅ Firestore initialized', 'color: #4CAF50; font-weight: bold;');

    // Initialize Realtime Database with explicit URL
    // Pass the URL explicitly to ensure it uses the correct region
    const realtimeDb: Database = getDatabase(app, firebaseConfig.databaseURL);
    console.log('%c✅ Realtime Database initialized', 'color: #4CAF50; font-weight: bold;');
    console.log(`Database URL: ${firebaseConfig.databaseURL}`);

    // Initialize Storage
    const storage: FirebaseStorage = getStorage(app);
    console.log('%c✅ Storage initialized', 'color: #4CAF50; font-weight: bold;');

    // Initialize Auth
    const auth: Auth = getAuth(app);
    console.log('%c✅ Authentication initialized', 'color: #4CAF50; font-weight: bold;');

    // Initialize Messaging
    const messaging: Messaging = getMessaging(app);
    console.log('%c✅ Messaging initialized', 'color: #4CAF50;');

    console.log(
      '%c🔥 ALL FIREBASE SERVICES INITIALIZED SUCCESSFULLY',
      'background: #4CAF50; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;'
    );

    return { app, auth, firestore, realtimeDb, storage, messaging };
  } catch (error) {
    console.error(
      '%c❌ FIREBASE INITIALIZATION ERROR:',
      'background: #F44336; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
      error
    );
    throw error;
  }
};

// Initialize all Firebase services (only once)
const firebase = initializeFirebase();

// Export the initialized services
export const firebaseApp = firebase.app;
export const auth = firebase.auth;
export const firestore = firebase.firestore;
export const realtimeDb = firebase.realtimeDb;
export const storage = firebase.storage;
export const messaging = firebase.messaging;

// Export the config for reference if needed
export const config = firebaseConfig;






