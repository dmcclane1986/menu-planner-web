"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/instantdb/auth";
import { db } from "@/lib/instantdb/config";
import {
  createRecipe,
  updateRecipe,
  deleteRecipe,
  deleteRecipeIngredients,
  createRecipeIngredients,
} from "@/lib/utils/recipes";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import type { Recipe, RecipeIngredient, MenuItem } from "@/types";

interface IngredientForm {
  name: string;
  quantity: number;
  unit: string;
}

export default function RecipesPage() {
  return (
    <ProtectedRoute>
      <RecipesContent />
    </ProtectedRoute>
  );
}

function RecipesContent() {
  const { user } = useAuth();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [menuItemId, setMenuItemId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [ingredients, setIngredients] = useState<IngredientForm[]>([
    { name: "", quantity: 0, unit: "" },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuItemFilter, setMenuItemFilter] = useState<string>("");

  // Query household members for this user
  const membersQuery = db.useQuery(
    user?.id
      ? {
          household_members: {
            $: {
              where: { user_id: user.id },
            },
          },
        }
      : null
  );

  // Query households
  const householdsQuery = db.useQuery({
    households: {},
  });

  // Query menu items for selected household
  const menuItemsQuery = db.useQuery(
    selectedHouseholdId
      ? {
          menu_items: {
            $: {
              where: { household_id: selectedHouseholdId, is_hidden: false },
            },
          },
        }
      : null
  );

  // Query all recipes (we'll filter by menu item IDs client-side)
  const recipesQuery = db.useQuery({
    recipes: {},
  });

  // Query all recipe ingredients (we'll filter by recipe IDs client-side)
  const ingredientsQuery = db.useQuery({
    recipe_ingredients: {},
  });

  // Filter recipes and ingredients for selected household's menu items
  const menuItems = menuItemsQuery.data?.menu_items || [];
  const menuItemIds = new Set(menuItems.map((mi: any) => mi.id));
  
  const allRecipes = recipesQuery.data?.recipes || [];
  let recipes = allRecipes.filter((recipe: any) => menuItemIds.has(recipe.menu_item_id));
  
  // Filter recipes by selected menu item
  if (menuItemFilter) {
    recipes = recipes.filter((recipe: any) => recipe.menu_item_id === menuItemFilter);
  }
  
  const recipeIds = new Set(recipes.map((r: any) => r.id));
  const allIngredients = ingredientsQuery.data?.recipe_ingredients || [];
  const recipeIngredients = allIngredients.filter((ing: any) => recipeIds.has(ing.recipe_id));

  const householdMembers = membersQuery.data?.household_members || [];
  const allHouseholds = householdsQuery.data?.households || [];

  const isLoading =
    membersQuery.isLoading ||
    householdsQuery.isLoading ||
    menuItemsQuery.isLoading ||
    recipesQuery.isLoading ||
    ingredientsQuery.isLoading;

  // Filter households to only those the user is a member of
  const userHouseholds = householdMembers
    .map((member: any) => {
      const household = allHouseholds.find((h: any) => h.id === member.household_id);
      return household;
    })
    .filter((h: any) => h !== undefined);

  // Auto-select first household if none selected and user has households
  useEffect(() => {
    if (!selectedHouseholdId && userHouseholds.length > 0 && userHouseholds[0]) {
      setSelectedHouseholdId(userHouseholds[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHouseholdId, householdMembers, allHouseholds]);

  // Get ingredients for a recipe
  const getRecipeIngredients = (recipeId: string): RecipeIngredient[] => {
    return recipeIngredients.filter((ing: any) => ing.recipe_id === recipeId) as RecipeIngredient[];
  };

  // Get menu item for a recipe
  const getRecipeMenuItem = (menuItemId: string): MenuItem | undefined => {
    return menuItems.find((mi: any) => mi.id === menuItemId) as MenuItem | undefined;
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: 0, unit: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof IngredientForm, value: string | number) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedHouseholdId) return;

    setError("");
    setLoading(true);

    try {
      const validIngredients = ingredients.filter(
        (ing) => ing.name.trim() !== ""
      );

      if (!menuItemId) {
        throw new Error("Please select a menu item");
      }

      if (validIngredients.length === 0) {
        throw new Error("Please add at least one ingredient");
      }

      await createRecipe({
        menuItemId,
        instructions: instructions.trim() || "",
        prepTime: parseInt(prepTime) || 0,
        cookTime: parseInt(cookTime) || 0,
        servings: parseInt(servings) || 0,
        ingredients: validIngredients.map((ing) => ({
          name: ing.name.trim(),
          quantity: ing.quantity || 0,
          unit: ing.unit.trim(),
        })),
      });

      // Reset form
      setMenuItemId("");
      setInstructions("");
      setPrepTime("");
      setCookTime("");
      setServings("");
      setIngredients([{ name: "", quantity: 0, unit: "" }]);
      setShowCreateForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to create recipe");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipe) return;

    setError("");
    setLoading(true);

    try {
      const validIngredients = ingredients.filter(
        (ing) => ing.name.trim() !== ""
      );

      if (!menuItemId) {
        throw new Error("Please select a menu item");
      }

      if (validIngredients.length === 0) {
        throw new Error("Please add at least one ingredient");
      }

      // Update recipe fields
      await updateRecipe(editingRecipe.id, {
        instructions: instructions.trim() || "",
        prep_time: parseInt(prepTime) || 0,
        cook_time: parseInt(cookTime) || 0,
        servings: parseInt(servings) || 0,
      });

      // Delete old ingredients and create new ones
      const existingIngredients = getRecipeIngredients(editingRecipe.id);
      if (existingIngredients.length > 0) {
        await deleteRecipeIngredients(existingIngredients.map((ing) => ing.id));
      }

      await createRecipeIngredients(
        editingRecipe.id,
        validIngredients.map((ing) => ({
          name: ing.name.trim(),
          quantity: ing.quantity,
          unit: ing.unit.trim(),
        }))
      );

      // Reset form
      setEditingRecipe(null);
      setMenuItemId("");
      setInstructions("");
      setPrepTime("");
      setCookTime("");
      setServings("");
      setIngredients([{ name: "", quantity: 0, unit: "" }]);
    } catch (err: any) {
      setError(err.message || "Failed to update recipe");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!confirm("Are you sure you want to delete this recipe? This action cannot be undone."))
      return;

    setError("");
    setLoading(true);

    try {
      // Delete ingredients first
      const existingIngredients = getRecipeIngredients(recipeId);
      if (existingIngredients.length > 0) {
        await deleteRecipeIngredients(existingIngredients.map((ing) => ing.id));
      }

      await deleteRecipe(recipeId);
    } catch (err: any) {
      setError(err.message || "Failed to delete recipe");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setMenuItemId(recipe.menu_item_id);
    setInstructions(recipe.instructions);
    setPrepTime(recipe.prep_time.toString());
    setCookTime(recipe.cook_time.toString());
    setServings(recipe.servings.toString());

    const existingIngredients = getRecipeIngredients(recipe.id);
    if (existingIngredients.length > 0) {
      setIngredients(
        existingIngredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
        }))
      );
    } else {
      setIngredients([{ name: "", quantity: 0, unit: "" }]);
    }

    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingRecipe(null);
    setMenuItemId("");
    setInstructions("");
    setPrepTime("");
    setCookTime("");
    setServings("");
    setIngredients([{ name: "", quantity: 0, unit: "" }]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (userHouseholds.length === 0) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-primary">Recipes</h1>
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">You&apos;re not part of any households yet.</p>
            <p className="text-sm text-gray-500 mb-4">
              Join or create a household to start adding recipes.
            </p>
            <Button onClick={() => (window.location.href = "/household")}>
              Go to Households
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const menuItemOptions = [
    { value: "", label: "None - Select a menu item" },
    ...menuItems.map((mi: any) => ({
      value: mi.id,
      label: `${mi.name} (${mi.genre})`,
    })),
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-primary">Recipes</h1>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* Household Selection */}
        {userHouseholds.length > 1 && (
          <Card className="mb-6">
            <label className="block text-sm font-medium mb-2 text-foreground">
              Select Household
            </label>
            <select
              value={selectedHouseholdId || ""}
              onChange={(e) => setSelectedHouseholdId(e.target.value)}
              className="w-full px-4 py-2 bg-secondary-light border border-secondary-lighter rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {userHouseholds.map((household: any) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          </Card>
        )}

        {/* Filter Recipes */}
        {menuItems.length > 0 && (
          <Card className="mb-6">
            <label className="block text-sm font-medium mb-2 text-foreground">
              Filter by Menu Item
            </label>
            <Select
              value={menuItemFilter}
              onChange={(e) => setMenuItemFilter(e.target.value)}
              options={[
                { value: "", label: "All Menu Items" },
                ...menuItems.map((mi: any) => ({
                  value: mi.id,
                  label: `${mi.name} (${mi.genre})`,
                })),
              ]}
            />
            {menuItemFilter && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-gray-400">
                  Showing {recipes.length} recipe{recipes.length !== 1 ? "s" : ""}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMenuItemFilter("")}
                >
                  Clear Filter
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Create/Edit Form */}
        {!showCreateForm && !editingRecipe && (
          <Button
            onClick={() => {
              setShowCreateForm(true);
              setEditingRecipe(null);
              setMenuItemId("");
              setInstructions("");
              setPrepTime("");
              setCookTime("");
              setServings("");
              setIngredients([{ name: "", quantity: 0, unit: "" }]);
            }}
            className="mb-6"
            disabled={menuItems.length === 0}
          >
            + Add Recipe
          </Button>
        )}

        {menuItems.length === 0 && !showCreateForm && !editingRecipe && (
          <Card className="mb-6">
            <p className="text-gray-400 text-center py-4">
              No menu items available. Please create menu items first.
            </p>
            <Button onClick={() => (window.location.href = "/menu")} className="mx-auto block">
              Go to Menu Items
            </Button>
          </Card>
        )}

        {(showCreateForm || editingRecipe) && menuItems.length > 0 && (
          <Card className="mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingRecipe ? "Edit Recipe" : "Create Recipe"}
            </h2>
            <form onSubmit={editingRecipe ? handleUpdateRecipe : handleCreateRecipe}>
              <div className="space-y-4">
                <Select
                  label="Menu Item"
                  value={menuItemId}
                  onChange={(e) => setMenuItemId(e.target.value)}
                  options={menuItemOptions}
                  required
                />

                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="Prep Time (minutes) - Optional"
                    type="number"
                    min="0"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    placeholder="Optional"
                  />
                  <Input
                    label="Cook Time (minutes) - Optional"
                    type="number"
                    min="0"
                    value={cookTime}
                    onChange={(e) => setCookTime(e.target.value)}
                    placeholder="Optional"
                  />
                  <Input
                    label="Servings - Optional"
                    type="number"
                    min="0"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <Textarea
                  label="Instructions - Optional"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={6}
                  placeholder="Enter step-by-step instructions (optional)..."
                />

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-foreground">
                      Ingredients
                    </label>
                    <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                      + Add Ingredient
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {ingredients.map((ingredient, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <Input
                            placeholder="Ingredient name"
                            value={ingredient.name}
                            onChange={(e) =>
                              updateIngredient(index, "name", e.target.value)
                            }
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            placeholder="Quantity (optional)"
                            type="number"
                            min="0"
                            step="0.1"
                            value={ingredient.quantity || ""}
                            onChange={(e) =>
                              updateIngredient(index, "quantity", parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            placeholder="Unit (optional, e.g., cups, oz)"
                            value={ingredient.unit}
                            onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                          />
                        </div>
                        <div className="col-span-1">
                          {ingredients.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeIngredient(index)}
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading}>
                    {editingRecipe ? "Update" : "Create"} Recipe
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        )}

        {/* Recipes List */}
        {recipes.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Recipes</h2>
            {recipes.map((recipe: any) => {
              const menuItem = getRecipeMenuItem(recipe.menu_item_id);
              const recipeIngredients = getRecipeIngredients(recipe.id);

              return (
                <Card key={recipe.id}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">
                        {menuItem?.name || "Unknown Menu Item"}
                      </h3>
                      {(recipe.prep_time > 0 || recipe.cook_time > 0 || recipe.servings > 0) && (
                        <div className="grid grid-cols-3 gap-4 text-sm text-gray-400 mb-4">
                          {recipe.prep_time > 0 && (
                            <div>
                              <span className="font-medium">Prep:</span> {recipe.prep_time} min
                            </div>
                          )}
                          {recipe.cook_time > 0 && (
                            <div>
                              <span className="font-medium">Cook:</span> {recipe.cook_time} min
                            </div>
                          )}
                          {recipe.servings > 0 && (
                            <div>
                              <span className="font-medium">Servings:</span> {recipe.servings}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mb-4">
                        <h4 className="font-medium mb-2 text-foreground">Ingredients:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
                          {recipeIngredients.map((ing: any) => (
                            <li key={ing.id}>
                              {ing.quantity > 0 && `${ing.quantity} `}
                              {ing.unit && `${ing.unit} `}
                              {ing.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {recipe.instructions && recipe.instructions.trim() && (
                        <div>
                          <h4 className="font-medium mb-2 text-foreground">Instructions:</h4>
                          <p className="text-sm text-gray-400 whitespace-pre-wrap">
                            {recipe.instructions}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(recipe)}
                        disabled={loading}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRecipe(recipe.id)}
                        disabled={loading}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {recipes.length === 0 && !showCreateForm && !editingRecipe && menuItems.length > 0 && (
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">No recipes yet.</p>
            <p className="text-sm text-gray-500">Create your first recipe to get started.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
