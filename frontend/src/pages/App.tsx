import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "app";
import { toast } from "sonner";

export default function Home() {
  const navigate = useNavigate();
  const { user, loading } = useCurrentUser();
  
  // Redirect authenticated users to the Feed page
  useEffect(() => {
    if (user && !loading) {
      navigate("/Feed");
    }
  }, [user, loading, navigate]);
  
  // Only render for non-authenticated users
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-t-2 border-primary rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (user) {
    return null; // Don't render anything while redirecting
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 py-3 border-b flex items-center justify-between bg-card">
        <h1 className="text-xl font-bold">Meetu</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate("/Login")}>
            Sign In
          </Button>
        </div>
      </header>
      
      <main className="flex-grow bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
                Meet friends for activities with ease
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Meetu makes it simple to organize and join activities with friends and meet new people with similar interests.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={() => navigate("/Login")} className="rounded-full">
                  Get Started
                </Button>
              </div>
            </div>
            
            <div className="rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-primary/10 to-secondary/10 p-6">
              <div className="aspect-[4/3] relative overflow-hidden rounded-lg bg-background/80 shadow-inner">
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary"
                    >
                      <circle cx="9" cy="9" r="1" />
                      <circle cx="15" cy="9" r="1" />
                      <circle cx="12" cy="15" r="1" />
                      <path d="M9 9a9 9 0 0 1 12 6c0 3-2 4-2 4s-2.5-1-4.5-1S10 19 8 19a3 3 0 0 1-3-3c0-2 4-12 4-12z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold">Join activities near you</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Find and join activities created by friends and people with similar interests.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-4 text-center">
                    <div className="rounded-lg border bg-card p-3">
                      <div className="text-xl font-bold">Easy</div>
                      <div className="text-xs text-muted-foreground">to connect</div>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <div className="text-xl font-bold">Fast</div>
                      <div className="text-xs text-muted-foreground">to organize</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
     {/* --- MODIFIED FOOTER --- */}
     <footer className="bg-muted py-6 px-4 border-t">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p className="mb-2">© 2025 Meetu. All rights reserved.</p>
          <Link to="/privacypolicy" className="underline hover:text-primary">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}