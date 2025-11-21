import { db } from "@/lib/instantdb/config";
import { id } from "@instantdb/react";
import type { MenuPlan, MealType } from "@/types";

export interface CreateMenuPlanInput {
  householdId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  menuItemId: string;
  mealType: MealType;
  userId: string;
  sideId?: string; // Optional: side to associate with this menu plan
}

export async function createMenuPlan(input: CreateMenuPlanInput): Promise<string> {
  const menuPlanId = id();

  const planData: any = {
    id: menuPlanId,
    household_id: input.householdId,
    date: input.date,
    menu_item_id: input.menuItemId,
    meal_type: input.mealType,
    created_by: input.userId,
    created_at: Date.now(),
  };

  if (input.sideId) {
    planData.side_id = input.sideId;
  }

  db.transact([
    db.tx.menu_plans[menuPlanId].update(planData),
  ]);

  return menuPlanId;
}

export async function updateMenuPlan(
  menuPlanId: string,
  updates: Partial<Pick<MenuPlan, "date" | "menu_item_id" | "meal_type" | "side_id">>
): Promise<void> {
  db.transact([
    db.tx.menu_plans[menuPlanId].update(updates),
  ]);
}

export async function deleteMenuPlan(menuPlanId: string): Promise<void> {
  db.transact([
    db.tx.menu_plans[menuPlanId].delete(),
  ]);
}
