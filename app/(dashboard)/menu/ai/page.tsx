"use client";

import { useState, useEffect, useMemo } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/instantdb/auth";
import { db } from "@/lib/instantdb/config";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { MealType, MenuGenre } from "@/types";
import { createMenuPlan, deleteMenuPlan } from "@/lib/utils/menuPlans";
import { saveAIPreferences } from "@/lib/utils/aiPreferences";

export default function AIMenuPage() {
  return (
    <ProtectedRoute>
      <AIMenuContent />
    </ProtectedRoute>
  );
}

function AIMenuContent() {
  const { user } = useAuth();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [dietaryInstructions, setDietaryInstructions] = useState("");
  const [genreWeights, setGenreWeights] = useState<Record<MenuGenre, number>>({
    Italian: 1.0,
    Mexican: 1.0,
    Asian: 1.0,
    American: 1.0,
    Other: 1.0,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [startDate, setStartDate] = useState("");

  const mealTypes: MealType[] = ["breakfast", "lunch", "dinner"];
  const mealTypeLabels: Record<MealType, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
  };

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

  // Query AI preferences for selected household
  const aiPreferencesQuery = db.useQuery(
    selectedHouseholdId
      ? {
          ai_preferences: {
            $: {
              where: { household_id: selectedHouseholdId },
            },
          },
        }
      : null
  );

  // Query menu plans for selected household (for caching check)
  const menuPlansQuery = db.useQuery(
    selectedHouseholdId
      ? {
          menu_plans: {
            $: {
              where: { household_id: selectedHouseholdId },
            },
          },
        }
      : null
  );

  const householdMembers = useMemo(() => membersQuery.data?.household_members || [], [membersQuery.data?.household_members]);
  const allHouseholds = useMemo(() => householdsQuery.data?.households || [], [householdsQuery.data?.households]);
  const menuItems = menuItemsQuery.data?.menu_items || [];
  const aiPreferences = aiPreferencesQuery.data?.ai_preferences?.[0];
  const existingMenuPlans = menuPlansQuery.data?.menu_plans || [];

  const isLoading =
    membersQuery.isLoading ||
    householdsQuery.isLoading ||
    menuItemsQuery.isLoading ||
    aiPreferencesQuery.isLoading;

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
  }, [selectedHouseholdId, householdMembers, allHouseholds, userHouseholds]);

  // Load AI preferences when household is selected
  useEffect(() => {
    if (selectedHouseholdId) {
      // Set default start date to next Monday
      const nextMonday = getNextMonday();
      setStartDate(nextMonday.toISOString().split("T")[0]);
    }
  }, [selectedHouseholdId]);

  // Load AI preferences from query
  useEffect(() => {
    if (aiPreferences) {
      setDietaryInstructions(aiPreferences.dietary_instructions || "");
      if (aiPreferences.genre_weights) {
        try {
          const weights = JSON.parse(aiPreferences.genre_weights);
          setGenreWeights((prev) => ({ ...prev, ...weights }));
        } catch (e) {
          // Use defaults if parsing fails
        }
      }
    }
  }, [aiPreferences]);

  const getNextMonday = (): Date => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday;
  };

  const toggleDayMeal = (day: string, mealType: MealType) => {
    const key = `${day}-${mealType}`;
    const newSelected = new Set(selectedDays);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedDays(newSelected);
  };

  const isSelected = (day: string, mealType: MealType): boolean => {
    return selectedDays.has(`${day}-${mealType}`);
  };

  const handleSavePreferences = async () => {
    if (!selectedHouseholdId) return;

    setError("");
    setLoading(true);

    try {
      await saveAIPreferences(
        selectedHouseholdId,
        {
          dietary_instructions: dietaryInstructions,
          genre_weights: genreWeights,
        },
        aiPreferences?.id
      );
      setError(""); // Clear any previous errors
      alert("Preferences saved successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to save preferences");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMenu = async () => {
    if (!user || !selectedHouseholdId) {
      setError("Please select a household");
      return;
    }

    if (selectedDays.size === 0) {
      setError("Please select at least one day and meal combination");
      return;
    }

    if (!startDate) {
      setError("Please select a start date");
      return;
    }

    setError("");
    setGenerating(true);

    try {
      // Parse selected days and meals
      const selections: Array<{ day: string; mealType: MealType; date: string }> = [];
      const startDateObj = new Date(startDate);
      
      selectedDays.forEach((key) => {
        const [day, mealType] = key.split("-") as [string, MealType];
        const dayIndex = daysOfWeek.indexOf(day);
        if (dayIndex !== -1) {
          const date = new Date(startDateObj);
          date.setDate(startDateObj.getDate() + dayIndex);
          selections.push({
            day,
            mealType,
            date: date.toISOString().split("T")[0],
          });
        }
      });

      // Check for existing menu plans (caching) - skip AI call if plans already exist
      const existingPlansForSelections = selections.filter((selection) => {
        return existingMenuPlans.some(
          (plan: any) =>
            plan.date === selection.date && plan.meal_type === selection.mealType
        );
      });

      let selectionsToGenerate = selections;
      let shouldOverwrite = false;

      if (existingPlansForSelections.length > 0) {
        const overwrite = confirm(
          `${existingPlansForSelections.length} of ${selections.length} selected meals already have menu plans. ` +
            "Do you want to regenerate them? (This will replace existing plans)"
        );

        if (!overwrite) {
          setGenerating(false);
          setError("Generation cancelled. Existing menu plans were preserved.");
          return;
        }

        shouldOverwrite = true;
        // Delete existing plans for the selections we're regenerating
        for (const selection of existingPlansForSelections) {
          const existingPlan = existingMenuPlans.find(
            (plan: any) =>
              plan.date === selection.date && plan.meal_type === selection.mealType
          );
          if (existingPlan) {
            await deleteMenuPlan(existingPlan.id);
          }
        }
        // If overwriting, generate all selections
        selectionsToGenerate = selections;
      } else {
        // Only generate selections that don't have existing plans
        selectionsToGenerate = selections.filter((selection) => {
          return !existingMenuPlans.some(
            (plan: any) =>
              plan.date === selection.date && plan.meal_type === selection.mealType
          );
        });
      }

      if (selectionsToGenerate.length === 0) {
        setError("All selected meals already have menu plans. No generation needed.");
        setGenerating(false);
        return;
      }

      // Calculate date range for two weeks before the week being generated
      const earliestSelectionDate = new Date(Math.min(...selectionsToGenerate.map(s => new Date(s.date).getTime())));
      const twoWeeksBeforeStart = new Date(earliestSelectionDate);
      twoWeeksBeforeStart.setDate(earliestSelectionDate.getDate() - 14);
      const twoWeeksBeforeEnd = new Date(earliestSelectionDate);
      twoWeeksBeforeEnd.setDate(earliestSelectionDate.getDate() - 1);
      
      const excludeStartDate = twoWeeksBeforeStart.toISOString().split("T")[0];
      const excludeEndDate = twoWeeksBeforeEnd.toISOString().split("T")[0];

      // Get menu items from the previous two weeks
      const excludedMenuPlans = existingMenuPlans.filter((plan: any) => {
        return plan.date >= excludeStartDate && plan.date <= excludeEndDate;
      });

      // Get unique menu item names from excluded plans
      const excludedMenuItemIds = new Set(excludedMenuPlans.map((plan: any) => plan.menu_item_id));
      const excludedMenuItemNames = menuItems
        .filter((mi: any) => excludedMenuItemIds.has(mi.id))
        .map((mi: any) => mi.name);

      // Call API to generate menu
      const response = await fetch("/api/ai/generate-menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          householdId: selectedHouseholdId,
          menuItems: menuItems.map((mi: any) => ({
            id: mi.id,
            name: mi.name,
            genre: mi.genre,
            popularity_score: mi.popularity_score || 0,
          })),
          selections: selectionsToGenerate,
          dietaryInstructions,
          genreWeights,
          excludedMenuItemNames,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate menu");
      }

      const result = await response.json();
      const generatedPlans = result.menuPlans;

      // Create menu plans in database
      let createdCount = 0;
      for (const plan of generatedPlans) {
        // Find menu item by name
        const menuItem = menuItems.find((mi: any) => mi.name === plan.menuItemName);
        if (menuItem) {
          await createMenuPlan({
            householdId: selectedHouseholdId,
            date: plan.date,
            menuItemId: menuItem.id,
            mealType: plan.mealType,
            userId: user.id,
          });
          createdCount++;
        }
      }

      const skippedCount = selections.length - selectionsToGenerate.length;
      let message = `Successfully generated ${createdCount} menu item(s)!`;
      if (skippedCount > 0 && !shouldOverwrite) {
        message += ` (${skippedCount} already existed and were skipped)`;
      }
      alert(message);
      setSelectedDays(new Set());
    } catch (err: any) {
      console.error("Error generating menu:", err);
      setError(err.message || "Failed to generate menu");
    } finally {
      setGenerating(false);
    }
  };

  if (userHouseholds.length === 0) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-primary">AI Menu Generation</h1>
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">You&apos;re not part of any households yet.</p>
            <p className="text-sm text-gray-500 mb-4">
              Join or create a household to start generating menus.
            </p>
            <Button onClick={() => (window.location.href = "/household")}>
              Go to Households
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary">AI Menu Generation</h1>
          {userHouseholds.length > 1 && (
            <select
              value={selectedHouseholdId || ""}
              onChange={(e) => setSelectedHouseholdId(e.target.value)}
              className="px-4 py-2 bg-secondary-light border border-secondary-lighter rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {userHouseholds.map((household: any) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Preferences */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <h2 className="text-xl font-semibold mb-4">AI Preferences</h2>
              
              {aiPreferences && (
                <div className="mb-4 p-3 bg-secondary-lighter rounded-lg">
                  <p className="text-xs font-medium text-foreground mb-1">Current Settings</p>
                  {aiPreferences.dietary_instructions && (
                    <p className="text-xs text-gray-400">
                      <span className="font-medium">Dietary:</span> {aiPreferences.dietary_instructions}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Last updated: {new Date(aiPreferences.updated_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Dietary Instructions
                  </label>
                  <textarea
                    value={dietaryInstructions}
                    onChange={(e) => setDietaryInstructions(e.target.value)}
                    placeholder="e.g., No nuts, vegetarian, low carb, gluten-free, dairy-free..."
                    className="w-full px-3 py-2 bg-background border border-secondary-lighter rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={6}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Enter any dietary restrictions, allergies, or preferences. This will be used when generating menus.
                  </p>
                  
                  {/* Common Dietary Presets */}
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">Quick Add:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Vegetarian",
                        "Vegan",
                        "Gluten-Free",
                        "Dairy-Free",
                        "Nut-Free",
                        "Low Carb",
                        "Keto",
                        "Paleo",
                        "No Pork",
                        "No Seafood",
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            const current = dietaryInstructions.trim();
                            if (current && !current.endsWith(",") && !current.endsWith(".")) {
                              setDietaryInstructions(current + ", " + preset.toLowerCase());
                            } else {
                              setDietaryInstructions(current + preset.toLowerCase());
                            }
                          }}
                          className="text-xs px-2 py-1 bg-secondary-lighter hover:bg-secondary-light border border-secondary-lighter rounded text-foreground transition-colors"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Genre Preferences
                  </label>
                  <div className="space-y-2">
                    {(["Italian", "Mexican", "Asian", "American", "Other"] as MenuGenre[]).map((genre) => (
                      <div key={genre} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{genre}</span>
                        <Input
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={genreWeights[genre]}
                          onChange={(e) =>
                            setGenreWeights({
                              ...genreWeights,
                              [genre]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-20"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Higher values = more likely to be selected (0-2)
                  </p>
                </div>

                <Button onClick={handleSavePreferences} disabled={loading} className="w-full">
                  {loading ? "Saving..." : aiPreferences ? "Update Preferences" : "Save Preferences"}
                </Button>
                {aiPreferences && (
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Preferences are automatically loaded when you select a household
                  </p>
                )}
              </div>
            </Card>
            
            {/* Info Card */}
            <Card className="bg-secondary-lighter">
              <h3 className="text-sm font-semibold mb-2">How It Works</h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Dietary instructions help AI avoid restricted foods</li>
                <li>• Genre preferences control cuisine variety</li>
                <li>• Settings are saved per household</li>
                <li>• AI uses these when generating menus</li>
              </ul>
            </Card>
          </div>

          {/* Right Column - Day/Meal Selection */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <h2 className="text-xl font-semibold mb-4">Select Days & Meals</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Start Date (Week Beginning)
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-sm font-medium text-foreground">Day</th>
                      {mealTypes.map((mealType) => (
                        <th key={mealType} className="text-center p-2 text-sm font-medium text-foreground">
                          {mealTypeLabels[mealType]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {daysOfWeek.map((day) => (
                      <tr key={day} className="border-t border-secondary-lighter">
                        <td className="p-3 font-medium text-foreground">{day}</td>
                        {mealTypes.map((mealType) => (
                          <td key={mealType} className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected(day, mealType)}
                              onChange={() => toggleDayMeal(day, mealType)}
                              className="w-5 h-5 text-primary rounded focus:ring-primary cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6">
                <p className="text-sm text-gray-400 mb-4">
                  Selected: {selectedDays.size} meal(s)
                </p>
                <Button
                  onClick={handleGenerateMenu}
                  disabled={generating || selectedDays.size === 0}
                  className="w-full"
                >
                  {generating ? "Generating Menu..." : "Generate Menu"}
                </Button>
              </div>
            </Card>

            {menuItems.length > 0 && (
              <Card>
                <h3 className="text-lg font-semibold mb-2">Available Menu Items</h3>
                <p className="text-sm text-gray-400 mb-4">
                  AI will select from {menuItems.length} menu item(s) in your household
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {menuItems.slice(0, 10).map((item: any) => (
                    <div key={item.id} className="text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-400 ml-2">({item.genre})</span>
                    </div>
                  ))}
                  {menuItems.length > 10 && (
                    <div className="text-sm text-gray-400">
                      +{menuItems.length - 10} more...
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

