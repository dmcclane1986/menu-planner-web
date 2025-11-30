// Type definitions for the menu planning app

export type MenuGenre = "Italian" | "Mexican" | "Asian" | "American" | "Other";
export type MealType = "breakfast" | "lunch" | "dinner";
export type HouseholdRole = "head" | "member";
export type VoteValue = 1 | -1;

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: number;
}

export interface Household {
  id: string;
  name: string;
  head_user_id: string;
  popularity_threshold: number;
  created_at: number;
}

export interface HouseholdMember {
  id: string;
  user_id: string;
  household_id: string;
  role: HouseholdRole;
  joined_at: number;
}

export interface MenuItem {
  id: string;
  household_id: string;
  name: string;
  genre: MenuGenre;
  created_by: string;
  created_at: number;
  popularity_score: number;
  is_hidden: boolean;
}

export interface Side {
  id: string;
  household_id: string;
  name: string;
  created_by: string;
  created_at: number;
  is_hidden: boolean;
}

export interface EntreeSide {
  id: string;
  entree_id: string; // menu_item_id (entree)
  side_id: string;
  created_at: number;
}

export interface Recipe {
  id: string;
  menu_item_id: string;
  instructions: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  created_at: number;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface MenuPlan {
  id: string;
  household_id: string;
  date: string; // ISO date string
  menu_item_id: string;
  meal_type: MealType;
  side_id?: string; // Optional: side associated with this menu plan
  created_by: string;
  created_at: number;
}

export interface MenuVote {
  id: string;
  menu_plan_id: string;
  user_id: string;
  vote: VoteValue;
  created_at: number;
}

export interface ShoppingList {
  id: string;
  household_id: string;
  date_range_start: string;
  date_range_end: string;
  created_at: number;
}

export interface ShoppingItem {
  id: string;
  shopping_list_id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  added_manually: boolean;
  sort_order?: number;
}

export interface ShoppingListTemplate {
  id: string;
  household_id: string;
  name: string;
  items: string; // JSON string of shopping items
  created_by: string;
  created_at: number;
}

export interface AIPreferences {
  id: string;
  household_id: string;
  dietary_instructions: string;
  genre_weights: string; // JSON string
  created_at: number;
  updated_at: number;
}

// Helper type for genre weights
export interface GenreWeights {
  Italian?: number;
  Mexican?: number;
  Asian?: number;
  American?: number;
  Other?: number;
}

