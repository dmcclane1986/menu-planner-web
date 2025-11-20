import { db } from "@/lib/instantdb/config";
import { id } from "@instantdb/react";
import type { MenuItem, MenuGenre } from "@/types";

export async function createMenuItem(
  householdId: string,
  name: string,
  genre: MenuGenre,
  userId: string
): Promise<string> {
  const menuItemId = id();

  db.transact([
    db.tx.menu_items[menuItemId].update({
      id: menuItemId,
      household_id: householdId,
      name,
      genre,
      created_by: userId,
      created_at: Date.now(),
      popularity_score: 0,
      is_hidden: false,
    }),
  ]);

  return menuItemId;
}

export async function updateMenuItem(
  menuItemId: string,
  updates: Partial<Pick<MenuItem, "name" | "genre" | "is_hidden" | "popularity_score">>
): Promise<void> {
  db.transact([
    db.tx.menu_items[menuItemId].update(updates),
  ]);
}

export async function hideMenuItem(menuItemId: string): Promise<void> {
  // Hide by setting is_hidden to true
  db.transact([
    db.tx.menu_items[menuItemId].update({
      is_hidden: true,
    }),
  ]);
}

export async function restoreMenuItem(menuItemId: string): Promise<void> {
  // Restore by setting is_hidden to false
  db.transact([
    db.tx.menu_items[menuItemId].update({
      is_hidden: false,
    }),
  ]);
}

export async function permanentlyDeleteMenuItem(menuItemId: string): Promise<void> {
  // Permanently delete the menu item from the database
  db.transact([
    db.tx.menu_items[menuItemId].delete(),
  ]);
}
