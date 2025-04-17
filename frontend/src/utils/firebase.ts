import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

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

// Initialize Firebase services
const initializeFirebase = () => {
  try {
    console.log('%c🔥 INITIALIZING FIREBASE SERVICES', 'background: #FFA000; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;');
    
    // Initialize the Firebase app if it hasn't been initialized yet
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    
    // Initialize Firestore
    const firestore = getFirestore(app);
    console.log('%c✅ Firestore initialized', 'color: #4CAF50; font-weight: bold;');
    
    // Initialize Realtime Database with explicit URL
    // Pass the URL explicitly to ensure it uses the correct region
    const database = getDatabase(app, firebaseConfig.databaseURL);
    console.log('%c✅ Realtime Database initialized', 'color: #4CAF50; font-weight: bold;');
    console.log(`Database URL: ${firebaseConfig.databaseURL}`);
    
    // Initialize Storage
    const storage = getStorage(app);
    console.log('%c✅ Storage initialized', 'color: #4CAF50; font-weight: bold;');
    
    // Initialize Auth
    const auth = getAuth(app);
    console.log('%c✅ Authentication initialized', 'color: #4CAF50; font-weight: bold;');
    
    console.log('%c🔥 ALL FIREBASE SERVICES INITIALIZED SUCCESSFULLY', 'background: #4CAF50; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;');
    
    return { app, firestore, database, storage, auth };
  } catch (error) {
    console.error('%c❌ FIREBASE INITIALIZATION ERROR:', 'background: #F44336; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;', error);
    throw error;
  }
};

// Initialize all Firebase services
const firebase = initializeFirebase();

// Export the initialized services
export const firebaseApp = firebase.app;
export const firestore = firebase.firestore;
export const realtimeDb = firebase.database;
export const storage = firebase.storage;
export const auth = firebase.auth;

// Export the config for reference if needed
export const config = firebaseConfig;
