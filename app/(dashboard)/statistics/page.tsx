"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/instantdb/auth";
import { db } from "@/lib/instantdb/config";
import { Card } from "@/components/ui/Card";
import { calculateVoteScore } from "@/lib/utils/votes";
import type { MenuItem, MenuPlan, MenuVote, ShoppingList } from "@/types";

export default function StatisticsPage() {
  return (
    <ProtectedRoute>
      <StatisticsContent />
    </ProtectedRoute>
  );
}

function StatisticsContent() {
  const { user } = useAuth();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);

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

  // Query menu plans
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

  // Query votes
  const votesQuery = db.useQuery({
    menu_votes: {},
  });

  // Query shopping lists
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

  const householdMembers = membersQuery.data?.household_members || [];
  const allHouseholds = householdsQuery.data?.households || [];
  const menuItems = menuItemsQuery.data?.menu_items || [];
  const menuPlans = menuPlansQuery.data?.menu_plans || [];
  const allVotes = votesQuery.data?.menu_votes || [];
  const shoppingLists = shoppingListsQuery.data?.shopping_lists || [];

  const isLoading =
    membersQuery.isLoading ||
    householdsQuery.isLoading ||
    menuItemsQuery.isLoading ||
    menuPlansQuery.isLoading ||
    votesQuery.isLoading ||
    shoppingListsQuery.isLoading;

  // Filter households to only those the user is a member of
  const userHouseholds = householdMembers
    .map((member: any) => {
      const household = allHouseholds.find((h: any) => h.id === member.household_id);
      return household;
    })
    .filter((h: any) => h !== undefined);

  // Auto-select first household if none selected
  useEffect(() => {
    if (!selectedHouseholdId && userHouseholds.length > 0 && userHouseholds[0]) {
      setSelectedHouseholdId(userHouseholds[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHouseholdId, householdMembers, allHouseholds]);

  // Get menu plan IDs for this household
  const menuPlanIds = new Set(menuPlans.map((p: any) => p.id));
  const relevantVotes = allVotes.filter((v: any) => menuPlanIds.has(v.menu_plan_id));

  // Calculate most popular menu items
  const menuItemStats = menuItems.map((item: any) => {
    const itemPlans = menuPlans.filter((p: any) => p.menu_item_id === item.id);
    const planIds = new Set(itemPlans.map((p: any) => p.id));
    const itemVotes = relevantVotes.filter((v: any) => planIds.has(v.menu_plan_id));
    
    // Group votes by plan
    const votesByPlan = new Map<string, typeof itemVotes>();
    itemVotes.forEach((v: any) => {
      if (!votesByPlan.has(v.menu_plan_id)) {
        votesByPlan.set(v.menu_plan_id, []);
      }
      votesByPlan.get(v.menu_plan_id)!.push(v);
    });

    let totalVoteScore = 0;
    let upvotes = 0;
    let downvotes = 0;
    votesByPlan.forEach((votes) => {
      const score = calculateVoteScore(votes as MenuVote[]);
      totalVoteScore += score;
      votes.forEach((v: any) => {
        if (v.vote === 1) upvotes++;
        if (v.vote === -1) downvotes++;
      });
    });

    return {
      ...item,
      planCount: itemPlans.length,
      totalVoteScore,
      upvotes,
      downvotes,
      voteCount: itemVotes.length,
    };
  });

  // Sort by popularity score (descending)
  const mostPopular = [...menuItemStats]
    .filter((item) => !item.is_hidden)
    .sort((a, b) => b.popularity_score - a.popularity_score)
    .slice(0, 10);

  // Calculate voting statistics
  const totalVotes = relevantVotes.length;
  const totalUpvotes = relevantVotes.filter((v: any) => v.vote === 1).length;
  const totalDownvotes = relevantVotes.filter((v: any) => v.vote === -1).length;
  const uniqueVoters = new Set(relevantVotes.map((v: any) => v.user_id)).size;

  // Calculate meal planning frequency
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const plansLast30Days = menuPlans.filter((p: any) => {
    const planDate = new Date(p.date);
    return planDate >= last30Days;
  }).length;

  const plansLast7Days = menuPlans.filter((p: any) => {
    const planDate = new Date(p.date);
    return planDate >= last7Days;
  }).length;

  // Group menu plans by date to get unique days
  const uniqueDays = new Set(menuPlans.map((p: any) => p.date)).size;
  const uniqueDaysLast30 = new Set(
    menuPlans
      .filter((p: any) => {
        const planDate = new Date(p.date);
        return planDate >= last30Days;
      })
      .map((p: any) => p.date)
  ).size;

  // Shopping list history
  const sortedShoppingLists = [...shoppingLists].sort(
    (a: any, b: any) => b.created_at - a.created_at
  );

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
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-primary">Statistics</h1>
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">You&apos;re not part of any households yet.</p>
            <p className="text-sm text-gray-500 mb-4">
              Join or create a household to view statistics.
            </p>
            <a
              href="/household"
              className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Go to Households
            </a>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Statistics & Analytics</h1>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most Popular Menu Items */}
          <Card>
            <h2 className="text-2xl font-semibold mb-4">Most Popular Menu Items</h2>
            {mostPopular.length > 0 ? (
              <div className="space-y-3">
                {mostPopular.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-secondary-lighter rounded"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-primary w-8">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-400">
                          {item.genre} • {item.planCount} time{item.planCount !== 1 ? "s" : ""} planned
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{item.popularity_score}</p>
                      <p className="text-xs text-gray-400">popularity</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No menu items with votes yet</p>
            )}
          </Card>

          {/* Voting Statistics */}
          <Card>
            <h2 className="text-2xl font-semibold mb-4">Voting Statistics</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-secondary-lighter rounded">
                  <p className="text-sm text-gray-400 mb-1">Total Votes</p>
                  <p className="text-3xl font-bold text-primary">{totalVotes}</p>
                </div>
                <div className="p-4 bg-secondary-lighter rounded">
                  <p className="text-sm text-gray-400 mb-1">Unique Voters</p>
                  <p className="text-3xl font-bold text-primary">{uniqueVoters}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded">
                  <p className="text-sm text-green-400 mb-1">Upvotes</p>
                  <p className="text-2xl font-bold text-green-400">{totalUpvotes}</p>
                </div>
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded">
                  <p className="text-sm text-red-400 mb-1">Downvotes</p>
                  <p className="text-2xl font-bold text-red-400">{totalDownvotes}</p>
                </div>
              </div>
              {totalVotes > 0 && (
                <div className="p-4 bg-secondary-lighter rounded">
                  <p className="text-sm text-gray-400 mb-1">Upvote Ratio</p>
                  <p className="text-2xl font-bold text-primary">
                    {((totalUpvotes / totalVotes) * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Meal Planning Frequency */}
          <Card>
            <h2 className="text-2xl font-semibold mb-4">Meal Planning Frequency</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-secondary-lighter rounded">
                  <p className="text-sm text-gray-400 mb-1">Total Plans</p>
                  <p className="text-3xl font-bold text-primary">{menuPlans.length}</p>
                </div>
                <div className="p-4 bg-secondary-lighter rounded">
                  <p className="text-sm text-gray-400 mb-1">Unique Days</p>
                  <p className="text-3xl font-bold text-primary">{uniqueDays}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-primary/10 border border-primary/30 rounded">
                  <p className="text-sm text-primary mb-1">Last 7 Days</p>
                  <p className="text-2xl font-bold text-primary">{plansLast7Days}</p>
                  <p className="text-xs text-gray-400 mt-1">meal plans</p>
                </div>
                <div className="p-4 bg-primary/10 border border-primary/30 rounded">
                  <p className="text-sm text-primary mb-1">Last 30 Days</p>
                  <p className="text-2xl font-bold text-primary">{plansLast30Days}</p>
                  <p className="text-xs text-gray-400 mt-1">meal plans</p>
                </div>
              </div>
              {uniqueDaysLast30 > 0 && (
                <div className="p-4 bg-secondary-lighter rounded">
                  <p className="text-sm text-gray-400 mb-1">Active Days (Last 30)</p>
                  <p className="text-2xl font-bold text-primary">{uniqueDaysLast30}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {((uniqueDaysLast30 / 30) * 100).toFixed(0)}% of days
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Shopping List History */}
          <Card>
            <h2 className="text-2xl font-semibold mb-4">Shopping List History</h2>
            {sortedShoppingLists.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedShoppingLists.slice(0, 10).map((list: any) => (
                  <div
                    key={list.id}
                    className="p-3 bg-secondary-lighter rounded flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(list.date_range_start).toLocaleDateString()} -{" "}
                        {new Date(list.date_range_end).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-400">
                        Created {new Date(list.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                {sortedShoppingLists.length > 10 && (
                  <p className="text-sm text-gray-400 text-center py-2">
                    + {sortedShoppingLists.length - 10} more lists
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No shopping lists yet</p>
            )}
            <div className="mt-4 p-4 bg-secondary-lighter rounded">
              <p className="text-sm text-gray-400 mb-1">Total Lists</p>
              <p className="text-2xl font-bold text-primary">{sortedShoppingLists.length}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

