import { type FirebaseApp, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { config } from "./config";

// Export the firebase app instance in case it's needed by other modules.
export const firebaseApp: FirebaseApp = initializeApp(config.firebaseConfig);

// Export the firebase auth instance
export const firebaseAuth = getAuth(firebaseApp);

// This string gets inlined by Vite at build time
export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;