import { id } from "@instantdb/admin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getInstantAdmin,
  getInstantAdminConfigError,
  getInstantEnvDebug,
} from "@/lib/server/instantAdmin";
import { authorizeMenuPlannerApiKey } from "@/lib/server/menuPlannerApiAuth";
import { recomputeMenuItemPopularity } from "@/lib/server/recomputeMenuItemPopularity";
import type { VoteValue } from "@/types";

// Env: MENU_PLANNER_API_KEY — Authorization: Bearer <MENU_PLANNER_API_KEY>
export const dynamic = "force-dynamic";

/** CamelCase wins if both are sent (chore-defense may send snake_case duplicates). */
const bodySchema = z
  .object({
    householdId: z.string().min(1).optional(),
    household_id: z.string().min(1).optional(),
    familyMemberId: z.string().min(1).optional(),
    family_member_id: z.string().min(1).optional(),
    menuItemId: z.string().min(1).optional(),
    menu_item_id: z.string().min(1).optional(),
    vote: z.enum(["up", "down"]),
  })
  .transform((data) => ({
    householdId: data.householdId ?? data.household_id,
    familyMemberId: data.familyMemberId ?? data.family_member_id,
    menuItemId: data.menuItemId ?? data.menu_item_id,
    vote: data.vote,
  }))
  .pipe(
    z.object({
      householdId: z.string().min(1),
      familyMemberId: z.string().min(1),
      menuItemId: z.string().min(1),
      vote: z.enum(["up", "down"]),
    })
  );

type MenuItemRow = { id: string; household_id: string };
type MemberRow = { id: string; household_id: string };
type ItemMemberVoteRow = {
  id: string;
  household_member_id: string;
  menu_item_id: string;
  vote: number;
};

export async function POST(request: NextRequest) {
  if (!authorizeMenuPlannerApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getInstantAdmin();
  if (!admin) {
    const body: Record<string, unknown> = { error: getInstantAdminConfigError() };
    if (process.env.NODE_ENV === "development") {
      body._instantEnvDebug = getInstantEnvDebug();
    }
    return NextResponse.json(body, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { householdId, familyMemberId, menuItemId, vote } = parsed.data;
  const voteValue: VoteValue = vote === "up" ? 1 : -1;

  const data = await admin.query({
    menu_items: { $: { where: { id: menuItemId } } },
    household_members: { $: { where: { id: familyMemberId } } },
    menu_item_member_votes: {
      $: {
        where: {
          household_member_id: familyMemberId,
          menu_item_id: menuItemId,
        },
      },
    },
  });

  const menuItem = (data.menu_items?.[0] ?? undefined) as MenuItemRow | undefined;
  if (!menuItem) {
    return NextResponse.json({ error: "menuItemId not found" }, { status: 404 });
  }

  const member = (data.household_members?.[0] ?? undefined) as MemberRow | undefined;
  if (!member) {
    return NextResponse.json({ error: "familyMemberId not found" }, { status: 404 });
  }

  if (member.household_id !== menuItem.household_id) {
    return NextResponse.json(
      { error: "Menu item is not in the same household as this member" },
      { status: 403 }
    );
  }

  if (menuItem.household_id !== householdId) {
    return NextResponse.json(
      { error: "householdId does not match this menu item or family member" },
      { status: 403 }
    );
  }

  const existing = (data.menu_item_member_votes?.[0] ?? undefined) as
    | ItemMemberVoteRow
    | undefined;
  const now = Date.now();

  if (existing) {
    await admin.transact([
      admin.tx.menu_item_member_votes[existing.id].update({
        vote: voteValue,
        updated_at: now,
      }),
    ]);
  } else {
    const newId = id();
    await admin.transact([
      admin.tx.menu_item_member_votes[newId].update({
        id: newId,
        household_member_id: familyMemberId,
        menu_item_id: menuItemId,
        vote: voteValue,
        created_at: now,
        updated_at: now,
      }),
    ]);
  }

  try {
    await recomputeMenuItemPopularity(admin, menuItemId, householdId);
  } catch (e) {
    console.error("menu vote: popularity recompute failed", e);
  }

  return NextResponse.json({ ok: true });
}
