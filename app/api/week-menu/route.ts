import { NextRequest, NextResponse } from "next/server";
import { getWeekMenuJson } from "@/lib/server/getWeekMenu";
import { authorizeMenuPlannerApiKey } from "@/lib/server/menuPlannerApiAuth";

// Env: MENU_PLANNER_API_KEY — authenticate with header: Authorization: Bearer <MENU_PLANNER_API_KEY>
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!authorizeMenuPlannerApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const householdId = request.nextUrl.searchParams.get("householdId")?.trim();
  if (!householdId) {
    return NextResponse.json(
      { error: "Query parameter householdId is required" },
      { status: 400 }
    );
  }

  const weekParam = request.nextUrl.searchParams.get("week");
  let anchor = new Date();
  if (weekParam) {
    const parsed = new Date(`${weekParam}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "Invalid week (use YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    anchor = parsed;
  }

  const result = await getWeekMenuJson(householdId, anchor);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message ?? "Server misconfiguration" },
      { status: 503 }
    );
  }

  return NextResponse.json(result.data);
}
