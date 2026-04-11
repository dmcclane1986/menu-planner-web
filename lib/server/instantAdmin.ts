import "server-only";

import { loadEnvConfig } from "@next/env";
import { init } from "@instantdb/admin";

// Ensure .env / .env.local are applied when this module loads (covers some Next runtimes / cwd edge cases).
loadEnvConfig(process.cwd());

function normalizeEnvValue(raw: string | undefined): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/^\uFEFF/, "").trim();
}

/** Read first non-empty env var by key (bracket access avoids some bundler inlining issues). */
function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const v = normalizeEnvValue(process.env[key]);
    if (v) return v;
  }
  return "";
}

/** Same ID the client uses (`lib/instantdb/config.ts`); aliases match Instant docs / samples. */
export function getInstantAppId(): string {
  return firstEnv(
    "NEXT_PUBLIC_INSTANTDB_APP_ID",
    "NEXT_PUBLIC_INSTANT_APP_ID",
    "INSTANT_APP_ID"
  );
}

/**
 * Server-only secret from Instant dashboard (App → Admin). Required for API routes using @instantdb/admin.
 * @see https://www.instantdb.com/docs/backend
 */
export function getInstantAdminToken(): string {
  return firstEnv(
    "INSTANT_APP_ADMIN_TOKEN",
    "INSTANT_ADMIN_TOKEN",
    "INSTANT_DB_ADMIN_TOKEN"
  );
}

/** For development 503 responses — booleans only, no secrets. */
export function getInstantEnvDebug(): {
  hasAppId: boolean;
  hasAdminToken: boolean;
} {
  return {
    hasAppId: Boolean(getInstantAppId()),
    hasAdminToken: Boolean(getInstantAdminToken()),
  };
}

/** Human-readable hint when admin client cannot be created (for 503 JSON bodies). */
export function getInstantAdminConfigError(): string {
  const appId = getInstantAppId();
  const adminToken = getInstantAdminToken();
  if (!appId && !adminToken) {
    return (
      "InstantDB is not configured for server API routes. Set NEXT_PUBLIC_INSTANTDB_APP_ID (or NEXT_PUBLIC_INSTANT_APP_ID) " +
      "and INSTANT_APP_ADMIN_TOKEN in .env.local in the project root (same folder as package.json), then restart `npm run dev`. " +
      "For Vercel, add both under Project Settings → Environment Variables and redeploy. " +
      "Admin token: https://instantdb.com/dash → your app → Admin."
    );
  }
  if (!appId) {
    return (
      "Missing InstantDB app ID. Set NEXT_PUBLIC_INSTANTDB_APP_ID (or NEXT_PUBLIC_INSTANT_APP_ID) to match your Instant app."
    );
  }
  return (
    "Missing INSTANT_APP_ADMIN_TOKEN. Add the admin token from https://instantdb.com/dash → your app → Admin " +
    "to .env.local as INSTANT_APP_ADMIN_TOKEN=... (project root, no quotes). Restart the dev server. " +
    "On Vercel, add it in Environment Variables (not Encrypted in a way that excludes serverless)."
  );
}

export function getInstantAdmin() {
  const appId = getInstantAppId();
  const adminToken = getInstantAdminToken();
  if (!appId || !adminToken) return null;
  return init({ appId, adminToken });
}
