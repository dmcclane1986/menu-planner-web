import "server-only";

import { init } from "@instantdb/admin";

export function getInstantAdmin() {
  const appId = (process.env.NEXT_PUBLIC_INSTANTDB_APP_ID || "").trim();
  const adminToken = (process.env.INSTANT_APP_ADMIN_TOKEN || "").trim();
  if (!appId || !adminToken) return null;
  return init({ appId, adminToken });
}
