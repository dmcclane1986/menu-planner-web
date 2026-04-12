import "server-only";

import { getInstantAdmin } from "@/lib/server/instantAdmin";
import { combinedPopularityScoreForItem } from "@/lib/utils/menuItemPopularity";

type InstantAdmin = NonNullable<ReturnType<typeof getInstantAdmin>>;

type MenuPlanRow = { id: string; menu_item_id: string };
type MenuVoteRow = { menu_plan_id: string; vote: number };
type MemberVoteRow = {
  menu_item_id: string;
  household_member_id: string;
  vote: number;
};
type HouseholdMemberRow = { id: string };
type HouseholdRow = { id: string; popularity_threshold?: number };

/**
 * Recomputes menu_items.popularity_score from menu_votes (per scheduled plan) plus
 * menu_item_member_votes (per household member), same formula as statistics / calendar.
 */
export async function recomputeMenuItemPopularity(
  admin: InstantAdmin,
  menuItemId: string,
  householdId: string
): Promise<void> {
  const data = await admin.query({
    menu_items: { $: { where: { id: menuItemId } } },
    menu_plans: { $: { where: { menu_item_id: menuItemId } } },
    menu_item_member_votes: { $: { where: { menu_item_id: menuItemId } } },
    household_members: { $: { where: { household_id: householdId } } },
    households: { $: { where: { id: householdId } } },
    menu_votes: {},
  });

  const item = data.menu_items?.[0] as unknown as { household_id: string } | undefined;
  if (!item || item.household_id !== householdId) {
    return;
  }

  const menuPlans = (data.menu_plans ?? []) as unknown as MenuPlanRow[];
  const menuVotes = (data.menu_votes ?? []) as unknown as MenuVoteRow[];
  const memberVotes = (data.menu_item_member_votes ?? []) as unknown as MemberVoteRow[];
  const roster = (data.household_members ?? []) as unknown as HouseholdMemberRow[];
  const householdMemberIds = new Set(roster.map((m) => m.id));

  const totalScore = combinedPopularityScoreForItem(
    menuItemId,
    menuPlans,
    menuVotes,
    householdMemberIds,
    memberVotes
  );

  const household = (data.households?.[0] ?? undefined) as unknown as
    | HouseholdRow
    | undefined;
  const threshold = household?.popularity_threshold ?? -5;

  await admin.transact([
    admin.tx.menu_items[menuItemId].update({
      popularity_score: totalScore,
      is_hidden: totalScore < threshold,
    }),
  ]);
}
