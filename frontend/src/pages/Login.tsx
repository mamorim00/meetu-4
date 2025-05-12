import React, { useEffect } from "react";
import { SignInOrUpForm, firebaseApp } from "app";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { firebaseAuth } from "app";
import { getAuth, GoogleAuthProvider, updateProfile, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "components/Layout";
import { doc, setDoc, getFirestore } from "firebase/firestore";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const db = getFirestore(firebaseApp);

  // Handle sign in with Google
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError("");
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      navigate("/feed");
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Failed to sign in with Google");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle email sign in/sign up
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    
    if (isSigningUp && !displayName) {
      setError("Please enter a display name");
      return;
    }
    
    try {
      setIsLoading(true);
      setError("");
      
      if (isSigningUp) {
        // Sign up
        if (isSigningUp) {
          // Signup
          const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
          const user = userCredential.user;
    
          if (user) {
            await updateProfile(user, { displayName });
    
            // Profile creation in Firestore
            const userDocRef = doc(db, 'userProfiles', user.uid);
            const newProfile = {
              userId: user.uid,
              displayName: displayName,
              email: user.email,
              photoURL: user.photoURL || null,
              createdAt: Date.now(),
              lastLoginAt: Date.now(),
              friends: []
            };
            
            await setDoc(userDocRef, newProfile);
            console.log("✅ User profile created successfully in Firestore");
          }
        }
      } else {
        // Sign in
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      }
      
      navigate("/feed");
    } catch (err: any) {
      console.error("Email auth error:", err);
      
      // Show user-friendly error message
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Invalid email or password");
      } else if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters");
      } else {
        setError("Authentication failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout hideNav>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-primary/5 to-secondary/5 p-4">
        <Toaster />
        <div className="w-full max-w-md bg-background rounded-3xl shadow-lg p-8 space-y-6">
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate(-1)} className="p-0 h-auto">
            <ArrowLeft className="h-5 w-5 mr-1" />
            <span>Back</span>
          </Button>
          <h1 className="text-2xl font-bold text-primary">Meetu</h1>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">{isSigningUp ? "Create Account" : "Welcome Back"}</h2>
          <p className="text-muted-foreground">
            {isSigningUp ? "Sign up to start your journey" : "Sign in to continue your journey"}
          </p>
        </div>
        
        {/* Google Sign-in Button */}
        <Button 
          variant="outline" 
          className="w-full flex items-center justify-center gap-2" 
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <svg viewBox="0 0 48 48" width="24" height="24">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
          </svg>
          Sign {isSigningUp ? "up" : "in"} with Google
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>
        
        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            {isSigningUp && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input 
                  id="displayName" 
                  type="text" 
                  placeholder="How others will see you" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90" 
              disabled={isLoading}
            >
              {isLoading 
                ? "Processing..." 
                : isSigningUp 
                  ? "Sign Up" 
                  : "Sign In"
              }
            </Button>
          </div>
        </form>

        <div className="text-center text-sm text-muted-foreground mt-6">
          <p>
            {isSigningUp 
              ? "Already have an account? " 
              : "Don't have an account? "
            }
            <Button 
              variant="link" 
              className="p-0 h-auto font-medium text-primary" 
              onClick={() => setIsSigningUp(!isSigningUp)}
            >
              {isSigningUp ? "Sign In" : "Sign Up"}
            </Button>
          </p>
        </div>
        </div>
      </div>
    </Layout>
  );
};