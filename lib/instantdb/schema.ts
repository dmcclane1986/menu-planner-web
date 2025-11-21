// InstantDB Schema Definition
// This defines the database structure for the menu planning app

// Genre types for menu items
export type MenuGenre = "Italian" | "Mexican" | "Asian" | "American" | "Other";

// Meal types
export type MealType = "breakfast" | "lunch" | "dinner";

// User roles in household
export type HouseholdRole = "head" | "member";

// Vote values
export type VoteValue = 1 | -1; // 1 for upvote, -1 for downvote

export const schema = {
  users: {
    id: { type: "string" },
    email: { type: "string" },
    name: { type: "string" },
    created_at: { type: "number" },
  },
  households: {
    id: { type: "string" },
    name: { type: "string" },
    head_user_id: { type: "string" },
    popularity_threshold: { type: "number", default: -5 }, // Configurable per household
    created_at: { type: "number" },
  },
  household_members: {
    id: { type: "string" },
    user_id: { type: "string" },
    household_id: { type: "string" },
    role: { type: "string" }, // "head" | "member"
    joined_at: { type: "number" },
  },
  menu_items: {
    id: { type: "string" },
    household_id: { type: "string" },
    name: { type: "string" },
    genre: { type: "string" }, // "Italian" | "Mexican" | "Asian" | "American" | "Other"
    created_by: { type: "string" },
    created_at: { type: "number" },
    popularity_score: { type: "number", default: 0 },
    is_hidden: { type: "boolean", default: false },
  },
  sides: {
    id: { type: "string" },
    household_id: { type: "string" },
    name: { type: "string" },
    created_by: { type: "string" },
    created_at: { type: "number" },
    is_hidden: { type: "boolean", default: false },
  },
  entree_sides: {
    id: { type: "string" },
    entree_id: { type: "string" }, // menu_item_id (entree)
    side_id: { type: "string" },
    created_at: { type: "number" },
  },
  recipes: {
    id: { type: "string" },
    menu_item_id: { type: "string" },
    instructions: { type: "string" },
    prep_time: { type: "number" }, // in minutes
    cook_time: { type: "number" }, // in minutes
    servings: { type: "number" },
    created_at: { type: "number" },
  },
  recipe_ingredients: {
    id: { type: "string" },
    recipe_id: { type: "string" },
    name: { type: "string" },
    quantity: { type: "number" },
    unit: { type: "string" },
  },
  menu_plans: {
    id: { type: "string" },
    household_id: { type: "string" },
    date: { type: "string" }, // ISO date string (YYYY-MM-DD)
    menu_item_id: { type: "string" },
    meal_type: { type: "string" }, // "breakfast" | "lunch" | "dinner"
    side_id: { type: "string" }, // Optional: side associated with this menu plan
    created_by: { type: "string" },
    created_at: { type: "number" },
  },
  menu_votes: {
    id: { type: "string" },
    menu_plan_id: { type: "string" },
    user_id: { type: "string" },
    vote: { type: "number" }, // 1 for upvote, -1 for downvote
    created_at: { type: "number" },
  },
  shopping_lists: {
    id: { type: "string" },
    household_id: { type: "string" },
    date_range_start: { type: "string" }, // ISO date string
    date_range_end: { type: "string" }, // ISO date string
    created_at: { type: "number" },
  },
  shopping_items: {
    id: { type: "string" },
    shopping_list_id: { type: "string" },
    ingredient_name: { type: "string" },
    quantity: { type: "number" },
    unit: { type: "string" },
    checked: { type: "boolean", default: false },
    added_manually: { type: "boolean", default: false },
  },
  ai_preferences: {
    id: { type: "string" },
    household_id: { type: "string" },
    dietary_instructions: { type: "string" },
    genre_weights: { type: "string" }, // JSON string of genre preferences {Italian: 1.0, Mexican: 0.8, etc.}
    created_at: { type: "number" },
    updated_at: { type: "number" },
  },
  shopping_list_templates: {
    id: { type: "string" },
    household_id: { type: "string" },
    name: { type: "string" },
    items: { type: "string" }, // JSON string of shopping items
    created_by: { type: "string" },
    created_at: { type: "number" },
  },
};

