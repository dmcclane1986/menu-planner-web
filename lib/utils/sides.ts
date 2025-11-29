import { db } from "@/lib/instantdb/config";
import { id } from "@instantdb/react";
import type { Side } from "@/types";

export async function createSide(
  householdId: string,
  name: string,
  userId: string
): Promise<string> {
  const sideId = id();

  db.transact([
    db.tx.sides[sideId].update({
      id: sideId,
      household_id: householdId,
      name,
      created_by: userId,
      created_at: Date.now(),
      is_hidden: false,
    }),
  ]);

  return sideId;
}

export async function updateSide(
  sideId: string,
  updates: Partial<Pick<Side, "name" | "is_hidden">>
): Promise<void> {
  db.transact([
    db.tx.sides[sideId].update(updates),
  ]);
}

export async function hideSide(sideId: string): Promise<void> {
  db.transact([
    db.tx.sides[sideId].update({
      is_hidden: true,
    }),
  ]);
}

export async function restoreSide(sideId: string): Promise<void> {
  db.transact([
    db.tx.sides[sideId].update({
      is_hidden: false,
    }),
  ]);
}

export async function permanentlyDeleteSide(sideId: string): Promise<void> {
  db.transact([
    db.tx.sides[sideId].delete(),
  ]);
}

