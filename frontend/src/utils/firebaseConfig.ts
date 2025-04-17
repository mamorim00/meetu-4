/**
 * Firebase configuration for the application
 * Contains configuration for all Firebase services used in the app
 */

// Firebase configuration object from your Firebase project settings
export const firebaseConfig = {
  apiKey: "AIzaSyDuWyFzPQGpgw8-WKMPjnHBfTTgFXe1ZkQ",
  authDomain: "meetu-23587.firebaseapp.com",
  projectId: "meetu-23587",
  storageBucket: "meetu-23587.appspot.com",
  messagingSenderId: "329099428437",
  appId: "1:329099428437:web:e8aa7f69cbfb22f1c1bcdc",
  measurementId: "G-8BVL7NC3MV",
  databaseURL: "https://meetudatabutton-default-rtdb.europe-west1.firebasedatabase.app" // Required for Realtime Database
};

// URLs for various Firebase services
export const firebaseServiceUrls = {
  // Realtime Database URL - explicit URL to ensure correct connection
  realtimeDatabase: "https://meetudatabutton-default-rtdb.europe-west1.firebasedatabase.app"
};
