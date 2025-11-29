import { db } from "@/lib/instantdb/config";
import { id } from "@instantdb/react";

export async function assignSideToEntree(
  entreeId: string,
  sideId: string
): Promise<string> {
  const entreeSideId = id();

  db.transact([
    db.tx.entree_sides[entreeSideId].update({
      id: entreeSideId,
      entree_id: entreeId,
      side_id: sideId,
      created_at: Date.now(),
    }),
  ]);

  return entreeSideId;
}

export async function removeSideFromEntree(entreeSideId: string): Promise<void> {
  db.transact([
    db.tx.entree_sides[entreeSideId].delete(),
  ]);
}

export async function removeAllSidesFromEntree(entreeId: string): Promise<void> {
  // This will need to be called with specific IDs, but we can query first
  // For now, we'll handle this in the component by querying and deleting each
}

