import { db } from "@/lib/instantdb/config";
import { id } from "@instantdb/react";
import type { Household, HouseholdMember } from "@/types";

export async function createHousehold(name: string, userId: string): Promise<string> {
  const householdId = id();
  const memberId = id();

  db.transact([
    db.tx.households[householdId].update({
      id: householdId,
      name,
      head_user_id: userId,
      popularity_threshold: -5,
      created_at: Date.now(),
    }),
    db.tx.household_members[memberId].update({
      id: memberId,
      user_id: userId,
      household_id: householdId,
      role: "head",
      joined_at: Date.now(),
    }),
  ]);

  return householdId;
}

export async function joinHousehold(householdId: string, userId: string): Promise<void> {
  const memberId = id();

  db.transact(
    db.tx.household_members[memberId].update({
      id: memberId,
      user_id: userId,
      household_id: householdId,
      role: "member",
      joined_at: Date.now(),
    })
  );
}

// Note: This is a helper function, but useQuery must be called in components
// The actual query logic is in the component

export function getHouseholdMembers(householdId: string) {
  return db.useQuery({
    household_members: {
      $: {
        where: { household_id: householdId },
      },
      user: {
        id: true,
        name: true,
        email: true,
      },
    },
  });
}

export async function updatePopularityThreshold(
  householdId: string,
  threshold: number
): Promise<void> {
  // Validate threshold is a number
  if (typeof threshold !== "number" || isNaN(threshold)) {
    throw new Error("Threshold must be a valid number");
  }

  db.transact([
    db.tx.households[householdId].update({
      popularity_threshold: threshold,
    }),
  ]);
}

