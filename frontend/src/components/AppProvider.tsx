import React, { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { UserProfileInitializer } from "./UserProfileInitializer";
import { useActivityStore } from "../utils/activityStore";
import { useCurrentUser } from "app";
import { useFriendsStore } from "../utils/friendsStore";
import { firebaseApp, realtimeDb } from "../utils/firebase";

// Import but don't use the firebase module to ensure it's initialized
import "../utils/firebase";

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // Get current user
  const { user } = useCurrentUser();
  const [firebaseReady, setFirebaseReady] = useState(false);
  
  // Confirm Firebase is initialized
  useEffect(() => {
    const checkFirebaseInit = () => {
      if (firebaseApp && realtimeDb) {
        console.log('%c🔥 Firebase initialized in AppProvider', 'color: #FFA000; font-weight: bold;');
        console.log('%c💾 Realtime Database reference ready:', 'color: #4CAF50; font-weight: bold;', !!realtimeDb);
        console.log('%c📟 Database URL:', 'color: #4CAF50; font-weight: bold;', realtimeDb.app.options.databaseURL || 'Not configured');
        setFirebaseReady(true);
        return true;
      } else {
        console.warn('%c⚠️ Firebase or Realtime Database not fully initialized', 'color: #FF9800; font-weight: bold;');
        return false;
      }
    };
    
    // Check immediately first
    if (!checkFirebaseInit()) {
      // If not ready, try a few more times with increasing delay
      const maxRetries = 3;
      let retryCount = 0;
      
      const retryInterval = setInterval(() => {
        retryCount++;
        console.log(`%c🔄 Retrying Firebase initialization (${retryCount}/${maxRetries})`, 'color: #FF9800; font-weight: bold;');
        
        if (checkFirebaseInit() || retryCount >= maxRetries) {
          clearInterval(retryInterval);
          
          if (retryCount >= maxRetries && !firebaseReady) {
            console.error('%c❌ Failed to initialize Firebase after multiple retries', 'color: #F44336; font-weight: bold;');
            // Still not ready after retries - we could show an error message to the user
            // but for now just log the error and let the app continue
          }
        }
      }, 1000); // Retry every second
      
      return () => clearInterval(retryInterval);
    }
  }, []);
  
  // Initialize activity store listener when the user changes
  useEffect(() => {
    if (!user) return;
    
    console.log('Initializing activity store with user:', user.uid, user.displayName || 'Unknown');
    
    // Initialize with user ID to filter activities based on privacy
    const unsubscribe = useActivityStore.getState().initializeListener(user.uid);
    
    return () => {
      // Clean up listener when component unmounts or user changes
      unsubscribe();
    };
  }, [user]);
  
  // Initialize friends store listener when the user changes
  useEffect(() => {
    if (!user) return;
    
    console.log('Initializing friends store with user:', user.uid);
    
    const unsubscribe = useFriendsStore.getState().initializeListeners(user.uid);
    
    return () => {
      // Clean up listener when component unmounts or user changes
      unsubscribe();
    };
  }, [user]);
  
  return (
    <>
      <UserProfileInitializer />
      {children}
      <Toaster closeButton position="top-right" richColors theme="light" />
    </>
  );
}