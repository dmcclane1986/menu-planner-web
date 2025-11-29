"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/instantdb/auth";
import { db } from "@/lib/instantdb/config";
import { createSide, updateSide, hideSide, restoreSide, permanentlyDeleteSide } from "@/lib/utils/sides";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Side } from "@/types";

export default function SidesPage() {
  return (
    <ProtectedRoute>
      <SidesContent />
    </ProtectedRoute>
  );
}

function SidesContent() {
  const { user } = useAuth();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSide, setEditingSide] = useState<Side | null>(null);
  const [sideName, setSideName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHiddenSides, setShowHiddenSides] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Query sides for selected household
  const sidesQuery = db.useQuery(
    selectedHouseholdId
      ? {
          sides: {
            $: {
              where: { household_id: selectedHouseholdId },
            },
          },
        }
      : null
  );

  const householdMembers = membersQuery.data?.household_members || [];
  const allHouseholds = householdsQuery.data?.households || [];
  const sides = sidesQuery.data?.sides || [];

  const isLoading = membersQuery.isLoading || householdsQuery.isLoading || sidesQuery.isLoading;

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

  const handleCreateSide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedHouseholdId) return;

    setError("");
    setLoading(true);

    try {
      await createSide(selectedHouseholdId, sideName, user.id);
      setSideName("");
      setShowCreateForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to create side");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSide) return;

    setError("");
    setLoading(true);

    try {
      await updateSide(editingSide.id, {
        name: sideName,
      });
      setEditingSide(null);
      setSideName("");
    } catch (err: any) {
      setError(err.message || "Failed to update side");
    } finally {
      setLoading(false);
    }
  };

  const handleHideSide = async (sideId: string) => {
    if (!confirm("Are you sure you want to hide this side?")) return;

    setError("");
    setLoading(true);

    try {
      await hideSide(sideId);
    } catch (err: any) {
      setError(err.message || "Failed to hide side");
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentlyDeleteSide = async (sideId: string) => {
    if (!confirm("Are you sure you want to permanently delete this side? This action cannot be undone.")) return;

    setError("");
    setLoading(true);

    try {
      await permanentlyDeleteSide(sideId);
    } catch (err: any) {
      setError(err.message || "Failed to delete side");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSide = async (sideId: string) => {
    setError("");
    setLoading(true);

    try {
      await restoreSide(sideId);
    } catch (err: any) {
      setError(err.message || "Failed to restore side");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (side: Side) => {
    setEditingSide(side);
    setSideName(side.name);
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingSide(null);
    setSideName("");
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
          <h1 className="text-3xl font-bold mb-8 text-primary">Sides</h1>
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">You&apos;re not part of any households yet.</p>
            <p className="text-sm text-gray-500 mb-4">
              Join or create a household to start adding sides.
            </p>
            <Button onClick={() => (window.location.href = "/household")}>
              Go to Households
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Filter sides based on search
  const filteredSides = sides.filter((side: any) => {
    // Filter by hidden status
    if (side.is_hidden) return false;
    
    // Filter by search query (name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return side.name.toLowerCase().includes(query);
    }
    
    return true;
  });

  const visibleSides = filteredSides;
  const hiddenSides = sides.filter((side: any) => side.is_hidden);

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-primary">Sides</h1>

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
        {!showCreateForm && !editingSide && (
          <Button
            onClick={() => {
              setShowCreateForm(true);
              setEditingSide(null);
              setSideName("");
            }}
            className="mb-6"
          >
            + Add Side
          </Button>
        )}

        {(showCreateForm || editingSide) && (
          <Card className="mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingSide ? "Edit Side" : "Create Side"}
            </h2>
            <form onSubmit={editingSide ? handleUpdateSide : handleCreateSide}>
              <div className="space-y-4">
                <Input
                  label="Side Name"
                  value={sideName}
                  onChange={(e) => setSideName(e.target.value)}
                  required
                  placeholder="e.g., Garlic Bread, Rice, Salad"
                />
                <div className="flex gap-4">
                  <Button type="submit" disabled={loading}>
                    {editingSide ? "Update" : "Create"} Side
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

        {/* Search */}
        <Card className="mb-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Search Sides
            </label>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
            />
          </div>
          {searchQuery && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-400">
                Showing {visibleSides.length} result{visibleSides.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                }}
              >
                Clear Search
              </Button>
            </div>
          )}
        </Card>

        {/* Sides List */}
        {visibleSides.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Sides</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {visibleSides.map((side: any) => (
                <Card key={side.id}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{side.name}</h3>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(side)}
                        disabled={loading}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleHideSide(side.id)}
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

        {/* Hidden Sides Section */}
        {hiddenSides.length > 0 && (
          <div className="space-y-4 mt-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-gray-400">Hidden Sides</h2>
                <span className="px-2.5 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm font-medium">
                  {hiddenSides.length}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHiddenSides(!showHiddenSides)}
              >
                {showHiddenSides ? "Hide" : "Show"} Hidden Sides
              </Button>
            </div>
            {showHiddenSides && (
              <div className="grid gap-4 md:grid-cols-2">
                {hiddenSides.map((side: any) => (
                  <Card key={side.id} className="border-2 border-gray-500/30 bg-secondary-lighter/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-semibold text-gray-300">{side.name}</h3>
                          <span className="px-2 py-0.5 bg-gray-500/30 text-gray-400 rounded text-xs font-medium">
                            Hidden
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreSide(side.id)}
                          disabled={loading}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePermanentlyDeleteSide(side.id)}
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

        {visibleSides.length === 0 && hiddenSides.length === 0 && !showCreateForm && (
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">No sides yet.</p>
            <p className="text-sm text-gray-500">Create your first side to get started.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

