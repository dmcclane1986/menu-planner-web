import { init } from "@instantdb/react";

// InstantDB app ID - needs to be public for client-side React components
const APP_ID = process.env.NEXT_PUBLIC_INSTANTDB_APP_ID || "";

if (!APP_ID) {
  console.warn("NEXT_PUBLIC_INSTANTDB_APP_ID is not set");
}

// Initialize InstantDB
// Note: Token is only needed for server-side admin operations
// Client-side auth uses InstantDB's built-in auth system
export const db = init({
  appId: APP_ID,
});

// Export useAuth hook from InstantDB
export const { useAuth } = db;

