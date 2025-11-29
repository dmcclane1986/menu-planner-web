import { db } from "@/lib/instantdb/config";
import { id } from "@instantdb/react";
import type { Recipe, RecipeIngredient } from "@/types";

export interface CreateRecipeInput {
  menuItemId: string;
  instructions: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: Omit<RecipeIngredient, "id" | "recipe_id">[];
}

export async function createRecipe(input: CreateRecipeInput): Promise<string> {
  const recipeId = id();
  const ingredientIds = input.ingredients.map(() => id());

  const ingredientUpdates = input.ingredients.map((ingredient, index) =>
    db.tx.recipe_ingredients[ingredientIds[index]].update({
      id: ingredientIds[index],
      recipe_id: recipeId,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    })
  );

  db.transact([
    db.tx.recipes[recipeId].update({
      id: recipeId,
      menu_item_id: input.menuItemId,
      instructions: input.instructions,
      prep_time: input.prepTime,
      cook_time: input.cookTime,
      servings: input.servings,
      created_at: Date.now(),
    }),
    ...ingredientUpdates,
  ]);

  return recipeId;
}

export async function updateRecipe(
  recipeId: string,
  updates: Partial<Pick<Recipe, "instructions" | "prep_time" | "cook_time" | "servings">>
): Promise<void> {
  // Map prep_time and cook_time to the correct field names
  const mappedUpdates: any = {};
  if (updates.prep_time !== undefined) mappedUpdates.prep_time = updates.prep_time;
  if (updates.cook_time !== undefined) mappedUpdates.cook_time = updates.cook_time;
  if (updates.servings !== undefined) mappedUpdates.servings = updates.servings;
  if (updates.instructions !== undefined) mappedUpdates.instructions = updates.instructions;

  db.transact([
    db.tx.recipes[recipeId].update(mappedUpdates),
  ]);
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  // First, delete all ingredients
  // Note: In InstantDB, we need to query ingredients first, then delete them
  // This is a simplified version - in production, you might want to handle cascading deletes
  db.transact([
    db.tx.recipes[recipeId].delete(),
    // Ingredients will need to be deleted separately by querying them first
  ]);
}

export async function deleteRecipeIngredients(
  ingredientIds: string[]
): Promise<void> {
  // Delete existing ingredients by their IDs
  if (ingredientIds.length === 0) return;
  
  const deletes = ingredientIds.map((id) => db.tx.recipe_ingredients[id].delete());
  db.transact(deletes);
}

export async function createRecipeIngredients(
  recipeId: string,
  ingredients: Omit<RecipeIngredient, "id" | "recipe_id">[]
): Promise<void> {
  if (ingredients.length === 0) return;
  
  const ingredientIds = ingredients.map(() => id());
  const ingredientUpdates = ingredients.map((ingredient, index) =>
    db.tx.recipe_ingredients[ingredientIds[index]].update({
      id: ingredientIds[index],
      recipe_id: recipeId,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    })
  );

  db.transact(ingredientUpdates);
}
