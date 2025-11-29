"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/instantdb/auth";
import { db } from "@/lib/instantdb/config";
import { createMenuItem, updateMenuItem, hideMenuItem, restoreMenuItem, permanentlyDeleteMenuItem } from "@/lib/utils/menu";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import type { MenuItem, MenuGenre } from "@/types";

export default function MenuPage() {
  return (
    <ProtectedRoute>
      <MenuContent />
    </ProtectedRoute>
  );
}

function MenuContent() {
  const { user } = useAuth();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuItemName, setMenuItemName] = useState("");
  const [menuItemGenre, setMenuItemGenre] = useState<MenuGenre>("Other");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHiddenItems, setShowHiddenItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState<MenuGenre | "">("");

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
              where: { household_id: selectedHouseholdId },
            },
          },
        }
      : null
  );

  const householdMembers = membersQuery.data?.household_members || [];
  const allHouseholds = householdsQuery.data?.households || [];
  const menuItems = menuItemsQuery.data?.menu_items || [];

  const isLoading = membersQuery.isLoading || householdsQuery.isLoading || menuItemsQuery.isLoading;

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

  const genreOptions: Array<{ value: MenuGenre; label: string }> = [
    { value: "Italian", label: "Italian" },
    { value: "Mexican", label: "Mexican" },
    { value: "Asian", label: "Asian" },
    { value: "American", label: "American" },
    { value: "Other", label: "Other" },
  ];

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedHouseholdId) return;

    setError("");
    setLoading(true);

    try {
      await createMenuItem(selectedHouseholdId, menuItemName, menuItemGenre, user.id);
      setMenuItemName("");
      setMenuItemGenre("Other");
      setShowCreateForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to create menu item");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setError("");
    setLoading(true);

    try {
      await updateMenuItem(editingItem.id, {
        name: menuItemName,
        genre: menuItemGenre,
      });
      setEditingItem(null);
      setMenuItemName("");
      setMenuItemGenre("Other");
    } catch (err: any) {
      setError(err.message || "Failed to update menu item");
    } finally {
      setLoading(false);
    }
  };

  const handleHideMenuItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to hide this menu item?")) return;

    setError("");
    setLoading(true);

    try {
      await hideMenuItem(itemId);
    } catch (err: any) {
      setError(err.message || "Failed to hide menu item");
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentlyDeleteMenuItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to permanently delete this menu item? This action cannot be undone.")) return;

    setError("");
    setLoading(true);

    try {
      await permanentlyDeleteMenuItem(itemId);
    } catch (err: any) {
      setError(err.message || "Failed to delete menu item");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreMenuItem = async (itemId: string) => {
    setError("");
    setLoading(true);

    try {
      await restoreMenuItem(itemId);
    } catch (err: any) {
      setError(err.message || "Failed to restore menu item");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item: MenuItem) => {
    setEditingItem(item);
    setMenuItemName(item.name);
    setMenuItemGenre(item.genre);
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setMenuItemName("");
    setMenuItemGenre("Other");
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
          <h1 className="text-3xl font-bold mb-8 text-primary">Entrees</h1>
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">You&apos;re not part of any households yet.</p>
            <p className="text-sm text-gray-500 mb-4">
              Join or create a household to start adding entrees.
            </p>
            <Button onClick={() => (window.location.href = "/household")}>
              Go to Households
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Filter menu items based on search and genre
  const filteredMenuItems = menuItems.filter((item: any) => {
    // Filter by hidden status
    if (item.is_hidden) return false;
    
    // Filter by genre
    if (genreFilter && item.genre !== genreFilter) return false;
    
    // Filter by search query (name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(query);
    }
    
    return true;
  });

  const visibleMenuItems = filteredMenuItems;
  const hiddenMenuItems = menuItems.filter((item: any) => item.is_hidden);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-primary">Menu Items</h1>

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

        {/* Create/Edit Form */}
        {!showCreateForm && !editingItem && (
          <Button
            onClick={() => {
              setShowCreateForm(true);
              setEditingItem(null);
              setMenuItemName("");
              setMenuItemGenre("Other");
            }}
            className="mb-6"
          >
            + Add Entree
          </Button>
        )}

        {(showCreateForm || editingItem) && (
          <Card className="mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingItem ? "Edit Entree" : "Create Entree"}
            </h2>
            <form onSubmit={editingItem ? handleUpdateMenuItem : handleCreateMenuItem}>
              <div className="space-y-4">
                <Input
                  label="Entree Name"
                  value={menuItemName}
                  onChange={(e) => setMenuItemName(e.target.value)}
                  required
                  placeholder="e.g., Spaghetti Carbonara"
                />
                <Select
                  label="Genre"
                  value={menuItemGenre}
                  onChange={(e) => setMenuItemGenre(e.target.value as MenuGenre)}
                  options={genreOptions}
                  required
                />
                <div className="flex gap-4">
                  <Button type="submit" disabled={loading}>
                    {editingItem ? "Update" : "Create"} Entree
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      cancelEdit();
                      setShowCreateForm(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        )}

        {/* Search and Filter */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Search Entrees
              </label>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Filter by Genre
              </label>
              <Select
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value as MenuGenre | "")}
                options={[
                  { value: "", label: "All Genres" },
                  ...genreOptions,
                ]}
              />
            </div>
          </div>
          {(searchQuery || genreFilter) && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-400">
                Showing {visibleMenuItems.length} result{visibleMenuItems.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setGenreFilter("");
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </Card>

        {/* Menu Items List */}
        {visibleMenuItems.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Entrees</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {visibleMenuItems.map((item: any) => (
                <Card key={item.id}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{item.name}</h3>
                      <p className="text-sm text-gray-400 mb-1">
                        Genre: <span className="text-primary font-medium">{item.genre}</span>
                      </p>
                      <p className="text-sm text-gray-400">
                        Popularity Score: {item.popularity_score}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(item)}
                        disabled={loading}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleHideMenuItem(item.id)}
                        disabled={loading}
                      >
                        Hide
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Hidden Menu Items Section */}
        {hiddenMenuItems.length > 0 && (
          <div className="space-y-4 mt-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-gray-400">Hidden Entrees</h2>
                <span className="px-2.5 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm font-medium">
                  {hiddenMenuItems.length}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHiddenItems(!showHiddenItems)}
              >
                {showHiddenItems ? "Hide" : "Show"} Hidden Items
              </Button>
            </div>
            {showHiddenItems && (
              <div className="grid gap-4 md:grid-cols-2">
                {hiddenMenuItems.map((item: any) => (
                  <Card key={item.id} className="border-2 border-gray-500/30 bg-secondary-lighter/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-semibold text-gray-300">{item.name}</h3>
                          <span className="px-2 py-0.5 bg-gray-500/30 text-gray-400 rounded text-xs font-medium">
                            Hidden
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-1">
                          Genre: <span className="text-primary font-medium">{item.genre}</span>
                        </p>
                        <p className="text-sm text-gray-400">
                          Popularity Score:{" "}
                          <span
                            className={`font-medium ${
                              item.popularity_score < 0
                                ? "text-red-400"
                                : item.popularity_score === 0
                                ? "text-gray-400"
                                : "text-green-400"
                            }`}
                          >
                            {item.popularity_score}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1 italic">
                          This item was automatically hidden due to low popularity
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreMenuItem(item.id)}
                          disabled={loading}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePermanentlyDeleteMenuItem(item.id)}
                          disabled={loading}
                          className="text-red-400 border-red-400/50 hover:bg-red-500/10"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {visibleMenuItems.length === 0 && hiddenMenuItems.length === 0 && !showCreateForm && (
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">No entrees yet.</p>
            <p className="text-sm text-gray-500">Create your first entree to get started.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
