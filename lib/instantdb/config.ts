import { init } from "@instantdb/react";

// InstantDB app ID - needs to be public for client-side React components
const APP_ID = (process.env.NEXT_PUBLIC_INSTANTDB_APP_ID || "").trim();

if (!APP_ID) {
  if (typeof window !== "undefined") {
    // Client-side: log error to console
    console.error("⚠️ NEXT_PUBLIC_INSTANTDB_APP_ID is not set!");
    console.error("Please add NEXT_PUBLIC_INSTANTDB_APP_ID to your Vercel environment variables.");
  } else {
    // Server-side: log error
    console.error("⚠️ NEXT_PUBLIC_INSTANTDB_APP_ID is not set!");
  }
}

// Initialize InstantDB
// Note: Token is only needed for server-side admin operations
// Client-side auth uses InstantDB's built-in auth system
export const db = init({
  appId: APP_ID,
});

// Export useAuth hook from InstantDB
export const { useAuth } = db;

// Check if InstantDB is properly configured (available on both client and server)
export const isInstantDBConfigured = !!APP_ID;

