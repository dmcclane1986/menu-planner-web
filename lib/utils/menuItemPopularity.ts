import type { MenuVote } from "@/types";

export type MenuPlanRef = { id: string; menu_item_id: string };

export type MenuVoteRef = { menu_plan_id: string; vote: number };

export type MenuItemMemberVoteRef = {
  menu_item_id: string;
  household_member_id: string;
  vote: number;
};

function sumVoteValues(votes: { vote: number }[]): number {
  return votes.reduce((sum, v) => sum + v.vote, 0);
}

/**
 * Calendar / statistics: for one menu item, sum (per plan: sum of menu_votes) across all plans
 * that use this item.
 */
export function menuPlanVoteTotalForItem(
  menuItemId: string,
  menuPlans: MenuPlanRef[],
  menuVotes: MenuVoteRef[]
): number {
  const itemPlans = menuPlans.filter((p) => p.menu_item_id === menuItemId);
  const planIds = new Set(itemPlans.map((p) => p.id));
  const relevant = menuVotes.filter((v) => planIds.has(v.menu_plan_id));
  const votesByPlan = new Map<string, MenuVote[]>();
  for (const v of relevant) {
    const list = votesByPlan.get(v.menu_plan_id) ?? [];
    list.push(v as MenuVote);
    votesByPlan.set(v.menu_plan_id, list);
  }
  let total = 0;
  votesByPlan.forEach((votes) => {
    total += sumVoteValues(votes);
  });
  return total;
}

/** API / chore-defense votes: one row per (household member, menu item). */
export function memberVoteTotalForItem(
  menuItemId: string,
  householdMemberIds: Set<string>,
  memberVotes: MenuItemMemberVoteRef[]
): number {
  let total = 0;
  for (const mv of memberVotes) {
    if (mv.menu_item_id !== menuItemId) continue;
    if (householdMemberIds.has(mv.household_member_id)) {
      total += mv.vote;
    }
  }
  return total;
}

export function combinedPopularityScoreForItem(
  menuItemId: string,
  menuPlans: MenuPlanRef[],
  menuVotes: MenuVoteRef[],
  householdMemberIds: Set<string>,
  memberVotes: MenuItemMemberVoteRef[]
): number {
  return (
    menuPlanVoteTotalForItem(menuItemId, menuPlans, menuVotes) +
    memberVoteTotalForItem(menuItemId, householdMemberIds, memberVotes)
  );
}
