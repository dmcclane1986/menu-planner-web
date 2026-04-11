import "server-only";

import type { NextRequest } from "next/server";

/** Same as GET /api/week-menu: Authorization: Bearer MENU_PLANNER_API_KEY */
export function authorizeMenuPlannerApiKey(request: NextRequest): boolean {
  const key = process.env.MENU_PLANNER_API_KEY;
  const auth = request.headers.get("authorization");
  return !!(key && auth === `Bearer ${key}`);
}
