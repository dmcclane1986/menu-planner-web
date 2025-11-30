import { db } from "@/lib/instantdb/config";
import { id } from "@instantdb/react";
import type { ShoppingList, ShoppingItem, ShoppingListTemplate } from "@/types";

export interface CreateShoppingListInput {
  householdId: string;
  dateRangeStart: string; // ISO date string
  dateRangeEnd: string; // ISO date string
}

export interface ShoppingListIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export async function createShoppingList(
  input: CreateShoppingListInput
): Promise<string> {
  const shoppingListId = id();

  db.transact([
    db.tx.shopping_lists[shoppingListId].update({
      id: shoppingListId,
      household_id: input.householdId,
      date_range_start: input.dateRangeStart,
      date_range_end: input.dateRangeEnd,
      created_at: Date.now(),
    }),
  ]);

  return shoppingListId;
}

export async function deleteShoppingList(shoppingListId: string): Promise<void> {
  db.transact([
    db.tx.shopping_lists[shoppingListId].delete(),
  ]);
}

export async function createShoppingItems(
  shoppingListId: string,
  items: Omit<ShoppingItem, "id" | "shopping_list_id">[],
  startingSortOrder: number = 0
): Promise<void> {
  if (items.length === 0) return;

  const itemIds = items.map(() => id());
  const updates = items.map((item, index) =>
    db.tx.shopping_items[itemIds[index]].update({
      id: itemIds[index],
      shopping_list_id: shoppingListId,
      ingredient_name: item.ingredient_name,
      quantity: item.quantity,
      unit: item.unit,
      checked: item.checked || false,
      added_manually: item.added_manually || false,
      sort_order: item.sort_order ?? (startingSortOrder + index),
    })
  );

  db.transact(updates);
}

export async function updateShoppingItem(
  itemId: string,
  updates: Partial<Pick<ShoppingItem, "ingredient_name" | "quantity" | "unit" | "checked" | "sort_order">>
): Promise<void> {
  db.transact([
    db.tx.shopping_items[itemId].update(updates),
  ]);
}

export async function updateShoppingItemsOrder(
  items: Array<{ id: string; sort_order: number }>
): Promise<void> {
  if (items.length === 0) return;

  const updates = items.map((item) =>
    db.tx.shopping_items[item.id].update({ sort_order: item.sort_order })
  );

  db.transact(updates);
}

export async function deleteShoppingItem(itemId: string): Promise<void> {
  db.transact([
    db.tx.shopping_items[itemId].delete(),
  ]);
}

// Aggregate ingredients from multiple recipes
export function aggregateIngredients(
  ingredients: ShoppingListIngredient[]
): ShoppingListIngredient[] {
  const aggregated = new Map<string, ShoppingListIngredient>();

  ingredients.forEach((ing) => {
    // Normalize: trim whitespace, handle empty units consistently
    const normalizedName = (ing.name || "").trim();
    const normalizedUnit = (ing.unit || "").trim().toLowerCase();
    const quantity = ing.quantity || 0;

    // Skip ingredients with no name
    if (!normalizedName) {
      return;
    }

    // Create a key that groups ingredients with the same name and unit
    // Empty units are treated as a separate category (e.g., "salt" vs "salt cups")
    const key = `${normalizedName.toLowerCase()}_${normalizedUnit}`;
    const existing = aggregated.get(key);

    if (existing) {
      // Aggregate: add quantities together
      aggregated.set(key, {
        name: normalizedName, // Use the first name encountered (preserve original casing)
        quantity: existing.quantity + quantity,
        unit: normalizedUnit || "", // Use normalized unit
      });
    } else {
      // First occurrence of this ingredient
      aggregated.set(key, {
        name: normalizedName,
        quantity: quantity,
        unit: normalizedUnit || "",
      });
    }
  });

  return Array.from(aggregated.values());
}

// Shopping List Templates
export async function createShoppingListTemplate(
  householdId: string,
  name: string,
  items: Omit<ShoppingItem, "id" | "shopping_list_id">[],
  userId: string
): Promise<string> {
  const templateId = id();

  db.transact([
    db.tx.shopping_list_templates[templateId].update({
      id: templateId,
      household_id: householdId,
      name,
      items: JSON.stringify(items),
      created_by: userId,
      created_at: Date.now(),
    }),
  ]);

  return templateId;
}

export async function deleteShoppingListTemplate(templateId: string): Promise<void> {
  db.transact([
    db.tx.shopping_list_templates[templateId].delete(),
  ]);
}

export async function loadTemplateIntoList(
  templateId: string,
  shoppingListId: string
): Promise<void> {
  // Note: This requires querying the template first, which should be done in the component
  // This function just creates the items once the template data is available
}

export function parseTemplateItems(itemsJson: string): Omit<ShoppingItem, "id" | "shopping_list_id">[] {
  try {
    return JSON.parse(itemsJson);
  } catch {
    return [];
  }
}
