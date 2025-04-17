import { useCurrentUser } from "app";
import { useEffect } from "react";
import { useUserProfileStore } from "../utils/userProfileStore";

export function UserProfileInitializer() {
  const { user, loading } = useCurrentUser();
  const { initializeListener, initialized } = useUserProfileStore();
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    if (user && !initialized && !loading) {
      console.log('🔄 Initializing user profile for:', user.uid, user.displayName || 'Unknown');
      unsubscribe = initializeListener(user);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, loading, initializeListener, initialized]);
  
  return null;
}