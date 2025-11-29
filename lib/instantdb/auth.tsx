"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { db, useAuth as useInstantAuth, isInstantDBConfigured } from "./config";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sendMagicCode: (email: string) => Promise<void>;
  signInWithMagicCode: (email: string, code: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always call hooks at the top level - never conditionally
  // Use InstantDB's built-in useAuth hook (will handle errors internally if not configured)
  const { user: authUser } = useInstantAuth();
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Set a timeout to prevent infinite loading
  useEffect(() => {
    // If InstantDB is not configured, mark as complete immediately to avoid infinite loading
    if (!isInstantDBConfigured) {
      setAuthCheckComplete(true);
      return;
    }

    const timer = setTimeout(() => {
      setAuthCheckComplete(true);
    }, 1000); // Wait max 1 second for auth to resolve
    
    // If we have a definitive auth state, mark as complete immediately
    if (authUser !== undefined) {
      setAuthCheckComplete(true);
      clearTimeout(timer);
    }
    
    return () => clearTimeout(timer);
  }, [authUser]);

  // Fetch user data from InstantDB when authenticated (only if configured)
  const { data, isLoading } = db.useQuery(
    isInstantDBConfigured && authUser && authCheckComplete
      ? {
          users: {
            $: {
              where: { id: authUser.id },
            },
          },
        }
      : null
  );

  const dbUser = data?.users?.[0] as User | undefined;
  
  // Loading is true if:
  // - InstantDB is configured AND we haven't completed the initial auth check, OR
  // - InstantDB is configured AND we have an authUser and we're loading their data from the database
  const loading = isInstantDBConfigured && (!authCheckComplete || (authUser !== null && authUser !== undefined && isLoading));

  const sendMagicCode = async (email: string) => {
    if (!isInstantDBConfigured) {
      throw new Error("InstantDB is not configured. Please set NEXT_PUBLIC_INSTANTDB_APP_ID.");
    }
    await db.auth.sendMagicCode({ email });
  };

  const signInWithMagicCode = async (email: string, code: string, name?: string) => {
    if (!isInstantDBConfigured) {
      throw new Error("InstantDB is not configured. Please set NEXT_PUBLIC_INSTANTDB_APP_ID.");
    }
    const result = await db.auth.signInWithMagicCode({ email, code });
    if (result?.user) {
      // Create or update user record in InstantDB
      const userId = result.user.id;
      db.transact(
        db.tx.users[userId].update({
          id: userId,
          email: email,
          name: name || email.split("@")[0],
          created_at: Date.now(),
        })
      );
    }
  };

  const signOut = async () => {
    // InstantDB doesn't have a signOut method, user stays signed in
    // We'll handle this by clearing local state
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  // Build the value object - handle both configured and unconfigured states
  const value: AuthContextType = {
    user: isInstantDBConfigured 
      ? (dbUser || (authUser ? {
          id: authUser.id,
          email: authUser.email || "",
          name: authUser.email?.split("@")[0] || "User",
          created_at: Date.now(),
        } : null))
      : null,
    loading,
    sendMagicCode,
    signInWithMagicCode,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

