import { useCurrentUser } from "app";
import { useEffect } from "react";
import { useUserProfileStore } from "../utils/userProfileStore";
import { Layout } from "components/Layout";

export default function Logout() {
  // Get auth and profile store
  const { user } = useCurrentUser();
  const { profile } = useUserProfileStore();
  
  useEffect(() => {
    // If user is logged in, log them out
    if (user) {
      const performLogout = async () => {
        try {
          // Optional: perform any cleanup operations
          console.log(`Logging out user: ${profile?.displayName || user.email}`);
          
          // Sign out using Firebase Auth
          const { auth } = await import("app");
          await auth.signOut();
          
          // Redirect will happen automatically through UserGuard
        } catch (error) {
          console.error("Error during logout:", error);
        }
      };
      
      performLogout();
    }
  }, [user, profile]);

  return (
    <Layout hideNav>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Logging you out...</h2>
          <p className="text-muted-foreground">You'll be redirected shortly.</p>
        </div>
      </div>
    </Layout>
  );
}