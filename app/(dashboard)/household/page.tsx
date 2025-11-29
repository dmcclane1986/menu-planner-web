"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/instantdb/auth";
import { db } from "@/lib/instantdb/config";
import { createHousehold, joinHousehold, updatePopularityThreshold } from "@/lib/utils/household";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Household, HouseholdMember } from "@/types";

export default function HouseholdPage() {
  return (
    <ProtectedRoute>
      <HouseholdContent />
    </ProtectedRoute>
  );
}

function HouseholdContent() {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<string | null>(null);
  const [thresholdValue, setThresholdValue] = useState<{ [key: string]: string }>({});
  const [thresholdLoading, setThresholdLoading] = useState<{ [key: string]: boolean }>({});

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

  // Get all household IDs from members
  const householdIds = membersQuery.data?.household_members?.map((m: any) => m.household_id) || [];
  
  // Query all households (we'll filter in the component)
  // Note: For better performance with many households, you could query specific ones
  const householdsQuery = db.useQuery({
    households: {},
  });

  const householdMembers = membersQuery.data?.household_members || [];
  const allHouseholds = householdsQuery.data?.households || [];
  const isLoading = membersQuery.isLoading || householdsQuery.isLoading;
  
  // Filter households to only those the user is a member of, and join with member data
  const households = householdMembers
    .map((member: any) => {
      const household = allHouseholds.find((h: any) => h.id === member.household_id);
      return household ? { ...member, household } : null;
    })
    .filter((h: any) => h !== null);

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError("");
    setLoading(true);

    try {
      await createHousehold(householdName, user.id);
      setHouseholdName("");
      setShowCreateForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to create household");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError("");
    setLoading(true);

    try {
      await joinHousehold(joinCode, user.id);
      setJoinCode("");
      setShowJoinForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to join household");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditThreshold = (householdId: string, currentThreshold: number) => {
    setEditingThreshold(householdId);
    setThresholdValue({ ...thresholdValue, [householdId]: currentThreshold.toString() });
  };

  const handleCancelEditThreshold = (householdId: string) => {
    setEditingThreshold(null);
    setThresholdValue({ ...thresholdValue, [householdId]: "" });
  };

  const handleSaveThreshold = async (householdId: string) => {
    if (!user) return;

    const value = thresholdValue[householdId];
    if (!value || value.trim() === "") {
      setError("Please enter a threshold value");
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setError("Threshold must be a valid number");
      return;
    }

    setError("");
    setThresholdLoading({ ...thresholdLoading, [householdId]: true });

    try {
      await updatePopularityThreshold(householdId, numValue);
      setEditingThreshold(null);
      setThresholdValue({ ...thresholdValue, [householdId]: "" });
    } catch (err: any) {
      setError(err.message || "Failed to update threshold");
    } finally {
      setThresholdLoading({ ...thresholdLoading, [householdId]: false });
    }
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

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-primary">Households</h1>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* Create Household */}
        {!showCreateForm ? (
          <Button
            onClick={() => {
              setShowCreateForm(true);
              setShowJoinForm(false);
            }}
            className="mb-4"
          >
            Create New Household
          </Button>
        ) : (
          <Card className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Create Household</h2>
            <form onSubmit={handleCreateHousehold} className="space-y-4">
              <Input
                label="Household Name"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                required
                placeholder="My Family"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setHouseholdName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Join Household */}
        {!showJoinForm ? (
          <Button
            onClick={() => {
              setShowJoinForm(true);
              setShowCreateForm(false);
            }}
            variant="outline"
            className="mb-6"
          >
            Join Existing Household
          </Button>
        ) : (
          <Card className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Join Household</h2>
            <form onSubmit={handleJoinHousehold} className="space-y-4">
              <Input
                label="Household ID"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
                placeholder="Enter household ID"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Joining..." : "Join"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowJoinForm(false);
                    setJoinCode("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Household List */}
        {households.length > 0 && (
          <div className="space-y-4 mt-8">
            <h2 className="text-2xl font-semibold mb-4">Your Households</h2>
            {households.map((member: any) => {
              const household = member.household;
              if (!household) return null;
              
              const isHead = household.head_user_id === user?.id;

              return (
                <Card key={household.id}>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold mb-2">{household.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-400 mb-2 break-all">
                        <span className="block sm:inline">Household ID: </span>
                        <code className="bg-secondary-lighter px-2 py-1 rounded text-[10px] sm:text-xs break-all block sm:inline-block mt-1 sm:mt-0">{household.id}</code>
                      </p>
                      {isHead && (
                        <span className="inline-block mt-2 px-3 py-1 bg-primary/20 text-primary rounded-full text-xs sm:text-sm font-medium">
                          Head of Household
                        </span>
                      )}
                    </div>
                    <div className="w-full sm:w-auto sm:text-right sm:ml-4 flex-shrink-0">
                      {editingThreshold === household.id ? (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">
                              Threshold:
                            </label>
                            <input
                              type="number"
                              value={thresholdValue[household.id] || ""}
                              onChange={(e) =>
                                setThresholdValue({
                                  ...thresholdValue,
                                  [household.id]: e.target.value,
                                })
                              }
                              className="w-full sm:w-24 px-3 py-1.5 bg-secondary-light border border-secondary-lighter rounded-lg text-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                              placeholder="-5"
                            />
                          </div>
                          <div className="flex gap-2 sm:justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleSaveThreshold(household.id)}
                              disabled={thresholdLoading[household.id]}
                              className="flex-1 sm:flex-initial"
                            >
                              {thresholdLoading[household.id] ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelEditThreshold(household.id)}
                              disabled={thresholdLoading[household.id]}
                              className="flex-1 sm:flex-initial"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs sm:text-sm text-gray-400 sm:text-right">
                            Popularity Threshold: <span className="font-medium text-white">{household.popularity_threshold}</span>
                          </p>
                          {isHead && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartEditThreshold(household.id, household.popularity_threshold)}
                              className="w-full sm:w-auto"
                            >
                              Edit Threshold
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {households.length === 0 && !showCreateForm && !showJoinForm && (
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">You&apos;re not part of any households yet.</p>
            <p className="text-sm text-gray-500">Create a new household or join an existing one to get started.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

