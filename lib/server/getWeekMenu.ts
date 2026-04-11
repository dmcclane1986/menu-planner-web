import "server-only";

import {
  formatMenuCalendarDate,
  getMenuCalendarWeekDates,
} from "@/lib/menuCalendar/weekRange";
import {
  getInstantAdmin,
  getInstantAdminConfigError,
} from "@/lib/server/instantAdmin";
import type { MealType } from "@/types";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner"];

export type WeekMenuMealJson = {
  id: string;
  slot?: string;
  label: string;
};

export type WeekMenuDayJson = {
  date: string;
  meals: WeekMenuMealJson[];
};

export type WeekMenuJson = {
  weekStart: string;
  days: WeekMenuDayJson[];
};

type MenuPlanRow = {
  id: string;
  household_id: string;
  date: string;
  menu_item_id: string;
  meal_type: string;
  side_id?: string;
};

type MenuItemRow = { id: string; name: string; household_id: string; is_hidden?: boolean };
type SideRow = { id: string; name: string; household_id: string; is_hidden?: boolean };

function mealLabel(
  menuItem: MenuItemRow | undefined,
  side: SideRow | undefined
): string {
  const base = menuItem?.name ?? "Unknown menu item";
  if (side?.name) return `${base} · Side: ${side.name}`;
  return base;
}

/**
 * Loads menu_plans, menu_items, and sides the same way as /menu/calendar
 * (household-scoped plans; items/sides with is_hidden false), for one week.
 */
export async function getWeekMenuJson(
  householdId: string,
  anchorDate: Date
): Promise<
  | { ok: true; data: WeekMenuJson }
  | { ok: false; error: "config"; message?: string }
> {
  const admin = getInstantAdmin();
  if (!admin) {
    return {
      ok: false,
      error: "config",
      message: getInstantAdminConfigError(),
    };
  }

  const weekDates = getMenuCalendarWeekDates(anchorDate);
  const weekStart = formatMenuCalendarDate(weekDates[0]!);
  const dateSet = new Set(weekDates.map((d) => formatMenuCalendarDate(d)));

  const result = await admin.query({
    menu_plans: {
      $: { where: { household_id: householdId } },
    },
    menu_items: {
      $: { where: { household_id: householdId, is_hidden: false } },
    },
    sides: {
      $: { where: { household_id: householdId, is_hidden: false } },
    },
  });

  const plans = (result.menu_plans ?? []) as MenuPlanRow[];
  const menuItems = (result.menu_items ?? []) as MenuItemRow[];
  const sides = (result.sides ?? []) as SideRow[];

  const itemById = new Map(menuItems.map((m) => [m.id, m]));
  const sideById = new Map(sides.map((s) => [s.id, s]));

  const plansInWeek = plans.filter((p) => dateSet.has(p.date));

  const days: WeekMenuDayJson[] = weekDates.map((d) => {
    const date = formatMenuCalendarDate(d);
    const dayPlans = plansInWeek
      .filter((p) => p.date === date)
      .sort(
        (a, b) =>
          MEAL_ORDER.indexOf(a.meal_type as MealType) -
          MEAL_ORDER.indexOf(b.meal_type as MealType)
      );

    const meals: WeekMenuMealJson[] = dayPlans.map((p) => {
      const entree = itemById.get(p.menu_item_id);
      const side = p.side_id ? sideById.get(p.side_id) : undefined;
      return {
        id: p.id,
        slot: p.meal_type,
        label: mealLabel(entree, side),
      };
    });

    return { date, meals };
  });

  return {
    ok: true,
    data: {
      weekStart,
      days,
    },
  };
}
