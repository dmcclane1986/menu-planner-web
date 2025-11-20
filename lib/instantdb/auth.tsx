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
  // Check if InstantDB is configured
  if (!isInstantDBConfigured) {
    // Return error state if InstantDB is not configured
    const errorValue: AuthContextType = {
      user: null,
      loading: false,
      sendMagicCode: async () => {
        throw new Error("InstantDB is not configured. Please set NEXT_PUBLIC_INSTANTDB_APP_ID.");
      },
      signInWithMagicCode: async () => {
        throw new Error("InstantDB is not configured. Please set NEXT_PUBLIC_INSTANTDB_APP_ID.");
      },
      signOut: async () => {},
    };
    
    return (
      <AuthContext.Provider value={errorValue}>
        {children}
      </AuthContext.Provider>
    );
  }

  // Use InstantDB's built-in useAuth hook
  const { user: authUser } = useInstantAuth();
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Set a timeout to prevent infinite loading
  useEffect(() => {
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

  // Fetch user data from InstantDB when authenticated
  const { data, isLoading } = db.useQuery(
    authUser && authCheckComplete
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
  // - We haven't completed the initial auth check, OR
  // - We have an authUser and we're loading their data from the database
  const loading = !authCheckComplete || (authUser !== null && authUser !== undefined && isLoading);

  const sendMagicCode = async (email: string) => {
    await db.auth.sendMagicCode({ email });
  };

  const signInWithMagicCode = async (email: string, code: string, name?: string) => {
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
    window.location.href = "/login";
  };

  const value: AuthContextType = {
    user: dbUser || (authUser ? {
      id: authUser.id,
      email: authUser.email || "",
      name: authUser.email?.split("@")[0] || "User",
      created_at: Date.now(),
    } : null),
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

