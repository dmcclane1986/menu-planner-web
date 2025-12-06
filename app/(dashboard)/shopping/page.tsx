"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/instantdb/auth";
import { db } from "@/lib/instantdb/config";
import {
  createShoppingList,
  deleteShoppingList,
  createShoppingItems,
  updateShoppingItem,
  deleteShoppingItem,
  aggregateIngredients,
  createShoppingListTemplate,
  deleteShoppingListTemplate,
  parseTemplateItems,
  updateShoppingItemsOrder,
} from "@/lib/utils/shoppingLists";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function ShoppingListPage() {
  return (
    <ProtectedRoute>
      <ShoppingListContent />
    </ProtectedRoute>
  );
}

function ShoppingListContent() {
  const { user } = useAuth();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [showCheckedItems, setShowCheckedItems] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

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

  // Query shopping lists for selected household
  const shoppingListsQuery = db.useQuery(
    selectedHouseholdId
      ? {
          shopping_lists: {
            $: {
              where: { household_id: selectedHouseholdId },
            },
          },
        }
      : null
  );

  // Query shopping items for selected list
  const shoppingItemsQuery = db.useQuery(
    selectedListId
      ? {
          shopping_items: {
            $: {
              where: { shopping_list_id: selectedListId },
            },
          },
        }
      : null
  );

  // Query shopping list templates for selected household
  const templatesQuery = db.useQuery(
    selectedHouseholdId
      ? {
          shopping_list_templates: {
            $: {
              where: { household_id: selectedHouseholdId },
            },
          },
        }
      : null
  );

  // Query household members for selected household (for sharing)
  const householdMembersQuery = db.useQuery(
    selectedHouseholdId
      ? {
          household_members: {
            $: {
              where: { household_id: selectedHouseholdId },
            },
            user: {
              id: true,
              name: true,
              email: true,
            },
          },
        }
      : null
  );

  // Query all menu plans, recipes, and ingredients (needed for generation)
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

  const recipesQuery = db.useQuery({
    recipes: {},
  });

  const recipeIngredientsQuery = db.useQuery({
    recipe_ingredients: {},
  });

  // Query sides for selected household
  const sidesQuery = db.useQuery(
    selectedHouseholdId
      ? {
          sides: {
            $: {
              where: { household_id: selectedHouseholdId, is_hidden: false },
            },
          },
        }
      : null
  );

  const householdMembers = membersQuery.data?.household_members || [];
  const allHouseholds = householdsQuery.data?.households || [];
  const shoppingLists = shoppingListsQuery.data?.shopping_lists || [];
  const shoppingItems = shoppingItemsQuery.data?.shopping_items || [];
  const allMenuPlans = menuPlansQuery.data?.menu_plans || [];
  const allRecipes = recipesQuery.data?.recipes || [];
  const allRecipeIngredients = recipeIngredientsQuery.data?.recipe_ingredients || [];
  const allSides = sidesQuery.data?.sides || [];
  const currentHouseholdMembers = householdMembersQuery.data?.household_members || [];
  const templates = templatesQuery.data?.shopping_list_templates || [];

  const isLoading =
    membersQuery.isLoading ||
    householdsQuery.isLoading ||
    shoppingListsQuery.isLoading ||
    shoppingItemsQuery.isLoading ||
    menuPlansQuery.isLoading ||
    recipesQuery.isLoading ||
    recipeIngredientsQuery.isLoading ||
    sidesQuery.isLoading ||
    templatesQuery.isLoading ||
    householdMembersQuery.isLoading;

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

  // Set default week start date (today)
  useEffect(() => {
    if (!selectedWeekStart) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setSelectedWeekStart(today.toISOString().split("T")[0]);
    }
  }, [selectedWeekStart]);

  // Generate shopping list from selected week's menu plans
  const handleGenerateFromWeek = async () => {
    if (!user || !selectedHouseholdId) {
      setError("Please select a household first.");
      return;
    }

    if (!selectedWeekStart) {
      setError("Please select a week start date.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Give a moment for UI to update
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get start and end of selected week (selected date + 7 days)
      // Use the selected date exactly as-is to avoid timezone issues
      // The date input always returns YYYY-MM-DD format
      // Ensure we're using the exact string value without any conversion
      const dateRangeStart = selectedWeekStart.trim(); // Already in YYYY-MM-DD format from date input
      
      // Validate the date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRangeStart)) {
        throw new Error(`Invalid date format: ${dateRangeStart}. Expected YYYY-MM-DD format.`);
      }
      
      // Helper function to add days to a date string (YYYY-MM-DD format)
      // Uses pure date arithmetic to completely avoid timezone issues
      const addDaysToDateString = (dateStr: string, daysToAdd: number): string => {
        const [year, month, day] = dateStr.split('-').map(Number);
        
        // Helper to get days in a month (handles leap years)
        const getDaysInMonth = (y: number, m: number): number => {
          return new Date(y, m, 0).getDate();
        };
        
        let currentYear = year;
        let currentMonth = month;
        let currentDay = day + daysToAdd;
        
        // Handle day overflow
        while (currentDay > getDaysInMonth(currentYear, currentMonth)) {
          currentDay -= getDaysInMonth(currentYear, currentMonth);
          currentMonth += 1;
          if (currentMonth > 12) {
            currentMonth = 1;
            currentYear += 1;
          }
        }
        
        // Format back to YYYY-MM-DD
        return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
      };
      
      // Calculate end date: start date + 6 days = 7 days total (including start day)
      const dateRangeEnd = addDaysToDateString(dateRangeStart, 6);

      console.log("=== Shopping List Generation Debug ===");
      console.log("Selected week start input (raw):", selectedWeekStart);
      console.log("Selected week start input (type):", typeof selectedWeekStart);
      
      // Verify the date parsing
      const [testYear, testMonth, testDay] = dateRangeStart.split('-').map(Number);
      const testDate = new Date(testYear, testMonth - 1, testDay);
      console.log("Parsed date components:", { year: testYear, month: testMonth, day: testDay });
      console.log("Date object created:", testDate.toISOString());
      console.log("Date object local string:", testDate.toLocaleDateString());
      
      console.log("Date range start:", dateRangeStart);
      console.log("Date range end:", dateRangeEnd);
      console.log("Week range:", dateRangeStart, "to", dateRangeEnd);
      console.log("Selected household:", selectedHouseholdId);
      console.log("Total menu plans in database:", allMenuPlans.length);
      console.log("Menu plans sample:", allMenuPlans.slice(0, 3).map((p: any) => ({
        id: p.id,
        date: p.date,
        menu_item_id: p.menu_item_id,
        meal_type: p.meal_type
      })));

      // Filter menu plans for this week - only include plans within the exact date range
      const weekMenuPlans = allMenuPlans.filter((plan: any) => {
        if (!plan.date) return false;
        const planDate = plan.date.trim(); // Ensure no whitespace
        // Compare as ISO date strings (YYYY-MM-DD format)
        const inRange = planDate >= dateRangeStart && planDate <= dateRangeEnd;
        return inRange;
      });

      console.log("Menu plans for this week:", weekMenuPlans.length);
      console.log("Week menu plans details:", weekMenuPlans.map((p: any) => ({
        date: p.date,
        menu_item_id: p.menu_item_id,
        meal_type: p.meal_type
      })));

      if (weekMenuPlans.length === 0) {
        setError("No menu items scheduled for this week. Please add items to your calendar first.");
        setLoading(false);
        return;
      }

      // Create a map of menu_item_id -> recipe for quick lookup
      const menuItemToRecipe = new Map<string, any>();
      allRecipes.forEach((recipe: any) => {
        if (!menuItemToRecipe.has(recipe.menu_item_id)) {
          menuItemToRecipe.set(recipe.menu_item_id, recipe);
        }
      });

      console.log("Total recipes in database:", allRecipes.length);
      console.log("Menu item to recipe map size:", menuItemToRecipe.size);

      // Collect ingredients for each menu plan occurrence
      // This ensures if the same menu item appears multiple times, we get ingredients multiple times
      const allIngredientsList: Array<{ name: string; quantity: number; unit: string }> = [];
      const missingRecipes: string[] = [];

      weekMenuPlans.forEach((plan: any) => {
        const recipe = menuItemToRecipe.get(plan.menu_item_id);
        
        if (!recipe) {
          if (!missingRecipes.includes(plan.menu_item_id)) {
            missingRecipes.push(plan.menu_item_id);
          }
          return;
        }

        // Get all ingredients for this recipe
        const recipeIngredients = allRecipeIngredients.filter(
          (ing: any) => ing.recipe_id === recipe.id
        );

        // Add each ingredient to our collection
        recipeIngredients.forEach((ing: any) => {
          allIngredientsList.push({
            name: ing.name || "",
            quantity: ing.quantity || 0,
            unit: ing.unit || "",
          });
        });
      });

      console.log("Menu plans processed:", weekMenuPlans.length);
      console.log("Total ingredient occurrences collected:", allIngredientsList.length);
      console.log("Sample ingredients before aggregation:", allIngredientsList.slice(0, 5));

      if (missingRecipes.length > 0) {
        setError(
          `No recipes found for ${missingRecipes.length} menu item(s). Please add recipes to your menu items first.`
        );
        setLoading(false);
        return;
      }

      if (allIngredientsList.length === 0) {
        setError(
          "No ingredients found in recipes for scheduled menu items. Please add ingredients to your recipes."
        );
        setLoading(false);
        return;
      }

      // Convert to format for aggregation
      const ingredients = allIngredientsList;

      console.log("Ingredients before aggregation:", ingredients.length, "items");
      console.log("Sample ingredients:", ingredients.slice(0, 3));

      // Aggregate ingredients (combine like items - same name + unit)
      const aggregated = aggregateIngredients(ingredients);

      console.log("Ingredients after aggregation:", aggregated.length, "items");
      console.log("Aggregated ingredients:", aggregated);

      // Count sides from menu plans
      const sideCounts = new Map<string, number>();
      weekMenuPlans.forEach((plan: any) => {
        if (plan.side_id) {
          const currentCount = sideCounts.get(plan.side_id) || 0;
          sideCounts.set(plan.side_id, currentCount + 1);
        }
      });

      console.log("Side counts:", Array.from(sideCounts.entries()));

      // Prepare shopping items from ingredients
      const shoppingItemsFromIngredients = aggregated.map((ing) => ({
        ingredient_name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        checked: false,
        added_manually: false,
      }));

      // Add sides to shopping list with count
      const shoppingItemsFromSides = Array.from(sideCounts.entries()).map(([sideId, count]) => {
        const side = allSides.find((s: any) => s.id === sideId);
        if (!side) return null;
        return {
          ingredient_name: `${count} ${side.name}`,
          quantity: 0,
          unit: "",
          checked: false,
          added_manually: false,
        };
      }).filter(Boolean) as Array<{
        ingredient_name: string;
        quantity: number;
        unit: string;
        checked: boolean;
        added_manually: boolean;
      }>;

      const allShoppingItems = [...shoppingItemsFromIngredients, ...shoppingItemsFromSides];

      if (allShoppingItems.length === 0) {
        setError("No valid ingredients or sides to add to shopping list.");
        setLoading(false);
        return;
      }

      // Create shopping list
      const shoppingListId = await createShoppingList({
        householdId: selectedHouseholdId,
        dateRangeStart,
        dateRangeEnd,
      });

      console.log("Created shopping list:", shoppingListId);

      // Create shopping items
      await createShoppingItems(
        shoppingListId,
        allShoppingItems
      );

      console.log("Created", allShoppingItems.length, "shopping items");
      console.log("=== Generation Complete ===");

      setSelectedListId(shoppingListId);
      setLoading(false);
    } catch (err: any) {
      console.error("Error generating shopping list:", err);
      setError(err.message || "Failed to generate shopping list");
      setLoading(false);
    }
  };

  // Toggle item checked status
  const handleToggleItem = async (itemId: string, checked: boolean) => {
    setError("");
    setLoading(true);

    try {
      await updateShoppingItem(itemId, { checked: !checked });
    } catch (err: any) {
      setError(err.message || "Failed to update item");
    } finally {
      setLoading(false);
    }
  };

  // Add manual item
  const handleAddManualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListId) return;

    setError("");
    setLoading(true);

    try {
      if (!newItemName.trim()) {
        throw new Error("Please enter an item name");
      }

      // Get the next sort order (add at the end of unchecked items)
      const maxSortOrder = shoppingItems.reduce((max: number, item: any) => {
        return Math.max(max, item.sort_order ?? 0);
      }, -1);

      await createShoppingItems(selectedListId, [
        {
          ingredient_name: newItemName.trim(),
          quantity: parseFloat(newItemQuantity) || 0,
          unit: newItemUnit.trim(),
          checked: false,
          added_manually: true,
          sort_order: maxSortOrder + 1,
        },
      ]);

      setNewItemName("");
      setNewItemQuantity("");
      setNewItemUnit("");
    } catch (err: any) {
      setError(err.message || "Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  // Start editing an item
  const handleStartEdit = (item: any) => {
    setEditingItemId(item.id);
    setEditQuantity(item.quantity > 0 ? item.quantity.toString() : "");
    setEditUnit(item.unit || "");
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditQuantity("");
    setEditUnit("");
  };

  // Save edited item
  const handleSaveEdit = async (itemId: string) => {
    setError("");
    setLoading(true);

    try {
      await updateShoppingItem(itemId, {
        quantity: parseFloat(editQuantity) || 0,
        unit: editUnit.trim(),
      });
      setEditingItemId(null);
      setEditQuantity("");
      setEditUnit("");
    } catch (err: any) {
      setError(err.message || "Failed to update item");
    } finally {
      setLoading(false);
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to remove this item?")) return;

    setError("");
    setLoading(true);

    try {
      await deleteShoppingItem(itemId);
    } catch (err: any) {
      setError(err.message || "Failed to delete item");
    } finally {
      setLoading(false);
    }
  };

  // Delete shopping list
  const handleDeleteList = async (listId: string) => {
    if (!confirm("Are you sure you want to delete this shopping list?")) return;

    setError("");
    setLoading(true);

    try {
      await deleteShoppingList(listId);
      if (selectedListId === listId) {
        setSelectedListId(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete shopping list");
    } finally {
      setLoading(false);
    }
  };

  // Export shopping list as text
  const handleExportList = () => {
    if (!selectedList || shoppingItems.length === 0) return;

    const uncheckedItems = shoppingItems.filter((item: any) => !item.checked);
    const checkedItems = shoppingItems.filter((item: any) => item.checked);

    let text = `Shopping List\n`;
    text += `${parseLocalDate(selectedList.date_range_start).toLocaleDateString()} - ${parseLocalDate(selectedList.date_range_end).toLocaleDateString()}\n\n`;

    if (uncheckedItems.length > 0) {
      text += `To Buy:\n`;
      uncheckedItems.forEach((item: any) => {
        const qty = item.quantity > 0 ? `${item.quantity} ` : "";
        const unit = item.unit ? `${item.unit} ` : "";
        text += `- ${qty}${unit}${item.ingredient_name}\n`;
      });
      text += `\n`;
    }

    if (checkedItems.length > 0) {
      text += `Purchased:\n`;
      checkedItems.forEach((item: any) => {
        const qty = item.quantity > 0 ? `${item.quantity} ` : "";
        const unit = item.unit ? `${item.unit} ` : "";
        text += `- ${qty}${unit}${item.ingredient_name}\n`;
      });
    }

    // Create and download file
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopping-list-${selectedList.date_range_start}-${selectedList.date_range_end}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Print shopping list
  const handlePrintList = () => {
    if (!selectedList || shoppingItems.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const uncheckedItems = shoppingItems.filter((item: any) => !item.checked);
    const checkedItems = shoppingItems.filter((item: any) => item.checked);

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shopping List</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            color: #333;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .date-range {
            color: #666;
            margin-bottom: 20px;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
          }
          .item {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .item.purchased {
            text-decoration: line-through;
            color: #999;
          }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Shopping List</h1>
        <div class="date-range">
          ${parseLocalDate(selectedList.date_range_start).toLocaleDateString()} - ${parseLocalDate(selectedList.date_range_end).toLocaleDateString()}
        </div>
    `;

    if (uncheckedItems.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">To Buy (${uncheckedItems.length})</div>
      `;
      uncheckedItems.forEach((item: any) => {
        const qty = item.quantity > 0 ? `${item.quantity} ` : "";
        const unit = item.unit ? `${item.unit} ` : "";
        html += `<div class="item">${qty}${unit}${item.ingredient_name}</div>`;
      });
      html += `</div>`;
    }

    if (checkedItems.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">Purchased (${checkedItems.length})</div>
      `;
      checkedItems.forEach((item: any) => {
        const qty = item.quantity > 0 ? `${item.quantity} ` : "";
        const unit = item.unit ? `${item.unit} ` : "";
        html += `<div class="item purchased">${qty}${unit}${item.ingredient_name}</div>`;
      });
      html += `</div>`;
    }

    html += `
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Copy shopping list text to clipboard
  const handleCopyToClipboard = async () => {
    if (!selectedList || shoppingItems.length === 0) return;

    const uncheckedItems = shoppingItems.filter((item: any) => !item.checked);
    let text = `Shopping List\n`;
    text += `${parseLocalDate(selectedList.date_range_start).toLocaleDateString()} - ${parseLocalDate(selectedList.date_range_end).toLocaleDateString()}\n\n`;

    if (uncheckedItems.length > 0) {
      text += `To Buy:\n`;
      uncheckedItems.forEach((item: any) => {
        const qty = item.quantity > 0 ? `${item.quantity} ` : "";
        const unit = item.unit ? `${item.unit} ` : "";
        text += `- ${qty}${unit}${item.ingredient_name}\n`;
      });
    }

    try {
      await navigator.clipboard.writeText(text);
      setError("");
      // Show success message briefly
      const successMsg = "Shopping list copied to clipboard!";
      setError(successMsg);
      setTimeout(() => setError(""), 3000);
    } catch (err: any) {
      setError("Failed to copy to clipboard");
    }
  };

  // Save current list as template
  const handleSaveAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedHouseholdId || !selectedListId || shoppingItems.length === 0) return;

    if (!templateName.trim()) {
      setError("Please enter a template name");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Convert shopping items to template format (without checked status)
      const templateItems = shoppingItems.map((item: any) => ({
        ingredient_name: item.ingredient_name,
        quantity: item.quantity,
        unit: item.unit,
        checked: false, // Templates always start unchecked
        added_manually: item.added_manually,
      }));

      await createShoppingListTemplate(
        selectedHouseholdId,
        templateName.trim(),
        templateItems,
        user.id
      );

      setTemplateName("");
      setShowTemplateModal(false);
    } catch (err: any) {
      setError(err.message || "Failed to save template");
    } finally {
      setLoading(false);
    }
  };

  // Load template into current list
  const handleLoadTemplate = async (template: any) => {
    if (!selectedListId) {
      setError("Please select or create a shopping list first");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const templateItems = parseTemplateItems(template.items);
      
      if (templateItems.length === 0) {
        setError("Template is empty");
        setLoading(false);
        return;
      }

      await createShoppingItems(
        selectedListId,
        templateItems.map((item) => ({
          ...item,
          checked: false, // Always start unchecked
        }))
      );

      setShowLoadTemplateModal(false);
    } catch (err: any) {
      setError(err.message || "Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  // Create new list from template
  const handleCreateListFromTemplate = async (template: any) => {
    if (!user || !selectedHouseholdId) return;

    setError("");
    setLoading(true);

    try {
      const templateItems = parseTemplateItems(template.items);
      
      if (templateItems.length === 0) {
        setError("Template is empty");
        setLoading(false);
        return;
      }

      // Create a new shopping list with today's date range
      const today = new Date();
      const dateRangeStart = today.toISOString().split("T")[0];
      const dateRangeEnd = today.toISOString().split("T")[0];

      const shoppingListId = await createShoppingList({
        householdId: selectedHouseholdId,
        dateRangeStart,
        dateRangeEnd,
      });

      await createShoppingItems(
        shoppingListId,
        templateItems.map((item) => ({
          ...item,
          checked: false,
        }))
      );

      setSelectedListId(shoppingListId);
      setShowLoadTemplateModal(false);
    } catch (err: any) {
      setError(err.message || "Failed to create list from template");
    } finally {
      setLoading(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    setError("");
    setLoading(true);

    try {
      await deleteShoppingListTemplate(templateId);
    } catch (err: any) {
      setError(err.message || "Failed to delete template");
    } finally {
      setLoading(false);
    }
  };

  if (userHouseholds.length === 0) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-primary">Shopping Lists</h1>
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">You&apos;re not part of any households yet.</p>
            <p className="text-sm text-gray-500 mb-4">
              Join or create a household to start creating shopping lists.
            </p>
            <Button onClick={() => (window.location.href = "/household")}>
              Go to Households
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Filter shopping lists by search query
  const filteredShoppingLists = shoppingLists.filter((list: any) => {
    if (!listSearchQuery) return true;
    const query = listSearchQuery.toLowerCase();
    const startDate = parseLocalDate(list.date_range_start).toLocaleDateString().toLowerCase();
    const endDate = parseLocalDate(list.date_range_end).toLocaleDateString().toLowerCase();
    return startDate.includes(query) || endDate.includes(query);
  });

  // Sort items by sort_order, then filter
  const sortedShoppingItems = [...shoppingItems].sort((a: any, b: any) => {
    const orderA = a.sort_order ?? 999999;
    const orderB = b.sort_order ?? 999999;
    return orderA - orderB;
  });

  // Filter shopping items by search query and checked status
  const filteredShoppingItems = sortedShoppingItems.filter((item: any) => {
    // Hide checked items unless showCheckedItems is true
    if (item.checked && !showCheckedItems) return false;
    
    if (!itemSearchQuery) return true;
    const query = itemSearchQuery.toLowerCase();
    return item.ingredient_name.toLowerCase().includes(query);
  });

  // Get count of hidden checked items
  const hiddenCheckedCount = sortedShoppingItems.filter((item: any) => item.checked).length;

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    
    if (!draggedItemId || draggedItemId === targetItemId) {
      setDraggedItemId(null);
      return;
    }

    // Get unchecked items in current order for reordering
    const uncheckedItems = sortedShoppingItems.filter((item: any) => !item.checked);
    const draggedIndex = uncheckedItems.findIndex((item: any) => item.id === draggedItemId);
    const targetIndex = uncheckedItems.findIndex((item: any) => item.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItemId(null);
      return;
    }

    // Reorder the array
    const reorderedItems = [...uncheckedItems];
    const [draggedItem] = reorderedItems.splice(draggedIndex, 1);
    reorderedItems.splice(targetIndex, 0, draggedItem);

    // Update sort_order for all affected items
    const updates = reorderedItems.map((item: any, index: number) => ({
      id: item.id,
      sort_order: index,
    }));

    try {
      await updateShoppingItemsOrder(updates);
    } catch (err: any) {
      setError(err.message || "Failed to reorder items");
    }

    setDraggedItemId(null);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  // Helper function to parse a YYYY-MM-DD date string as a local date (not UTC)
  // This prevents timezone conversion issues when displaying dates
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Helper function to format date range for display
  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
  };

  const selectedList = shoppingLists.find((list: any) => list.id === selectedListId);
  const checkedCount = shoppingItems.filter((item: any) => item.checked).length;
  const uncheckedCount = shoppingItems.filter((item: any) => !item.checked).length;
  const totalCount = shoppingItems.length;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Shopping Lists</h1>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Lists and Generation */}
          <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
            {/* Generate Shopping List */}
            <Card>
              <h2 className="text-xl font-semibold mb-4">Generate Shopping List</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Week Start Date
                  </label>
                  <Input
                    type="date"
                    value={selectedWeekStart}
                    onChange={(e) => setSelectedWeekStart(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Select the start date. The list will include 7 days from this date.
                  </p>
                </div>
                <Button
                  onClick={handleGenerateFromWeek}
                  className="w-full"
                  disabled={loading || !selectedWeekStart}
                >
                  {loading ? "Generating..." : "Generate Shopping List"}
                </Button>
              </div>
            </Card>

            {/* Templates */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Templates</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLoadTemplateModal(true)}
                  >
                    Load Template
                  </Button>
                  {selectedListId && shoppingItems.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplateModal(true)}
                    >
                      Save as Template
                    </Button>
                  )}
                </div>
              </div>
              {templates.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {templates.map((template: any) => (
                    <div
                      key={template.id}
                      className="flex justify-between items-center p-2 bg-secondary-lighter rounded"
                    >
                      <span className="text-sm font-medium">{template.name}</span>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-red-500 hover:text-red-400 text-xs"
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {templates.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No templates yet. Save a shopping list as a template to get started.
                </p>
              )}
            </Card>

            {/* Shopping Lists */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Shopping Lists</h2>
              </div>
              <div className="mb-4">
                <Input
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="Search lists by date..."
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                {isLoading && filteredShoppingLists.length === 0 ? (
                  <Card className="text-center py-8">
                    <p className="text-gray-400 text-sm">Loading...</p>
                  </Card>
                ) : filteredShoppingLists.length === 0 ? (
                  <Card className="text-center py-8">
                    <p className="text-gray-400 text-sm">
                      {listSearchQuery ? "No lists found" : "No shopping lists yet"}
                    </p>
                  </Card>
                ) : (
                  filteredShoppingLists.map((list: any) => (
                    <Card
                      key={list.id}
                      className={`cursor-pointer transition-colors ${
                        selectedListId === list.id
                          ? "border-primary bg-primary/10"
                          : "hover:bg-secondary-lighter"
                      }`}
                      onClick={() => setSelectedListId(list.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            Week of {formatDateRange(list.date_range_start, list.date_range_end)}
                          </p>
                          <p className="text-sm text-gray-400">
                            Created {new Date(list.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list.id);
                          }}
                          className="text-red-500 hover:text-red-400 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Shopping Items */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            {selectedListId ? (
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      {selectedList ? `Shopping List - Week of ${formatDateRange(selectedList.date_range_start, selectedList.date_range_end)}` : 'Shopping List'}
                    </h2>
                    {selectedList && (
                      <p className="text-sm text-gray-400">
                        {parseLocalDate(selectedList.date_range_start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} - {parseLocalDate(selectedList.date_range_end).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                    )}
                    {totalCount > 0 && (
                      <p className="text-sm text-primary mt-1">
                        {uncheckedCount} item{uncheckedCount !== 1 ? "s" : ""} remaining
                        {checkedCount > 0 && ` • ${checkedCount} checked`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowShareModal(true)}
                      disabled={shoppingItems.length === 0}
                      className="touch-manipulation"
                    >
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportList()}
                      disabled={shoppingItems.length === 0}
                      className="touch-manipulation"
                    >
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintList()}
                      disabled={shoppingItems.length === 0}
                      className="touch-manipulation"
                    >
                      Print
                    </Button>
                  </div>
                </div>

                {/* Add Item Form */}
                <Card className="mb-6 bg-secondary-lighter">
                  <h3 className="font-semibold mb-4 text-sm md:text-base">Add Manual Item</h3>
                  <form onSubmit={handleAddManualItem}>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      <div className="md:col-span-5">
                        <Input
                          placeholder="Item name"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          required
                          className="text-base"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Input
                          placeholder="Quantity (optional)"
                          type="number"
                          min="0"
                          step="1"
                          value={newItemQuantity}
                          onChange={(e) => setNewItemQuantity(e.target.value)}
                          className="text-base"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Input
                          placeholder="Unit (optional)"
                          value={newItemUnit}
                          onChange={(e) => setNewItemUnit(e.target.value)}
                          className="text-base"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Button type="submit" size="sm" disabled={loading} className="w-full md:w-auto touch-manipulation">
                          Add
                        </Button>
                      </div>
                    </div>
                  </form>
                </Card>

                {/* Search Items and Show Checked Toggle */}
                {shoppingItems.length > 0 && (
                  <div className="mb-4 space-y-3">
                    <Input
                      type="text"
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      placeholder="Search items..."
                      className="w-full"
                    />
                    {hiddenCheckedCount > 0 && (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setShowCheckedItems(!showCheckedItems)}
                          className="text-sm text-primary hover:text-primary/80 flex items-center gap-2"
                        >
                          {showCheckedItems ? "▼" : "▶"} {hiddenCheckedCount} checked item{hiddenCheckedCount !== 1 ? "s" : ""} {showCheckedItems ? "shown" : "hidden"}
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-400">
                      💡 Drag items to reorder your shopping list
                    </p>
                  </div>
                )}

                {/* Shopping Items List */}
                {isLoading && shoppingItems.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 mb-4">Loading items...</p>
                  </div>
                ) : filteredShoppingItems.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 mb-4">
                      {itemSearchQuery ? "No items found" : "No items in this shopping list"}
                    </p>
                    {!itemSearchQuery && (
                      <p className="text-sm text-gray-500">
                        Generate from menu plans or add items manually
                      </p>
                    )}
                    {itemSearchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setItemSearchQuery("")}
                      >
                        Clear Search
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredShoppingItems.map((item: any) => (
                      <div
                        key={item.id}
                        draggable={!item.checked && editingItemId !== item.id}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, item.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg border transition-all ${
                          item.checked
                            ? "bg-secondary-lighter opacity-60 border-secondary-lighter"
                            : "bg-secondary-light border-secondary-lighter"
                        } ${
                          draggedItemId === item.id
                            ? "opacity-50 scale-95"
                            : ""
                        } ${
                          !item.checked && editingItemId !== item.id
                            ? "cursor-grab active:cursor-grabbing"
                            : ""
                        }`}
                      >
                        {/* Drag Handle */}
                        {!item.checked && editingItemId !== item.id && (
                          <div className="flex-shrink-0 text-gray-400 cursor-grab active:cursor-grabbing select-none">
                            <span className="text-lg">⋮⋮</span>
                          </div>
                        )}
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleToggleItem(item.id, item.checked)}
                          className="w-6 h-6 md:w-5 md:h-5 text-primary rounded focus:ring-primary touch-manipulation flex-shrink-0"
                          disabled={editingItemId === item.id}
                          aria-label={`Toggle ${item.ingredient_name}`}
                        />
                        <div className="flex-1">
                          <p
                            className={`font-medium ${
                              item.checked ? "line-through text-gray-500" : ""
                            }`}
                          >
                            {item.ingredient_name}
                          </p>
                          {editingItemId === item.id ? (
                            <div className="flex gap-2 mt-2">
                              <Input
                                placeholder="Quantity"
                                type="number"
                                min="0"
                                step="1"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                className="w-24"
                              />
                              <Input
                                placeholder="Unit (e.g., lbs, oz)"
                                value={editUnit}
                                onChange={(e) => setEditUnit(e.target.value)}
                                className="w-32"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(item.id)}
                                disabled={loading}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={loading}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              {(item.quantity > 0 || item.unit) && (
                                <p className="text-sm text-gray-400">
                                  {item.quantity > 0 && `${item.quantity} `}
                                  {item.unit}
                                </p>
                              )}
                              {item.added_manually && (
                                <span className="text-xs text-primary">Manual</span>
                              )}
                            </>
                          )}
                        </div>
                        {editingItemId !== item.id && (
                          <div className="flex gap-3 md:gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="text-primary hover:text-primary/80 active:text-primary/60 text-sm md:text-sm px-3 py-2 md:px-0 md:py-0 touch-manipulation"
                              disabled={loading}
                              aria-label={`Edit ${item.ingredient_name}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-red-500 hover:text-red-400 active:text-red-300 text-sm md:text-sm px-3 py-2 md:px-0 md:py-0 touch-manipulation"
                              disabled={loading}
                              aria-label={`Delete ${item.ingredient_name}`}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <Card className="text-center py-12">
                <p className="text-gray-400 mb-4">Select a shopping list to view items</p>
                <p className="text-sm text-gray-500">
                  Generate a shopping list from this week&apos;s menu plans
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Share Modal */}
        {showShareModal && selectedList && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md m-4">
              <h2 className="text-xl font-semibold mb-4">Share Shopping List</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-2">
                    This shopping list is shared with all household members:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {currentHouseholdMembers.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 p-2 bg-secondary-lighter rounded"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{member.user?.name || "Unknown"}</p>
                          <p className="text-xs text-gray-400">{member.user?.email || ""}</p>
                        </div>
                        {member.user_id === user?.id && (
                          <span className="text-xs text-primary">You</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCopyToClipboard}
                    className="flex-1"
                  >
                    Copy List to Clipboard
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowShareModal(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Save Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md m-4">
              <h2 className="text-xl font-semibold mb-4">Save as Template</h2>
              <form onSubmit={handleSaveAsTemplate}>
                <div className="space-y-4">
                  <Input
                    label="Template Name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    required
                    placeholder="e.g., Weekly Groceries"
                  />
                  <p className="text-sm text-gray-400">
                    This will save {shoppingItems.length} items as a reusable template.
                  </p>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Saving..." : "Save Template"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowTemplateModal(false);
                        setTemplateName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Load Template Modal */}
        {showLoadTemplateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md m-4">
              <h2 className="text-xl font-semibold mb-4">Load Template</h2>
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">No templates available</p>
                  <p className="text-sm text-gray-500 mb-4">
                    Save a shopping list as a template first
                  </p>
                  <Button variant="outline" onClick={() => setShowLoadTemplateModal(false)}>
                    Close
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {templates.map((template: any) => {
                      const templateItems = parseTemplateItems(template.items);
                      return (
                        <div
                          key={template.id}
                          className="p-3 bg-secondary-lighter rounded border border-secondary-lighter hover:border-primary/50 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium">{template.name}</p>
                              <p className="text-xs text-gray-400">
                                {templateItems.length} items
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {selectedListId ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLoadTemplate(template)}
                                disabled={loading}
                                className="flex-1"
                              >
                                Add to Current List
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCreateListFromTemplate(template)}
                                disabled={loading}
                                className="flex-1"
                              >
                                Create New List
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowLoadTemplateModal(false)}
                    className="w-full"
                  >
                    Close
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}