"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/instantdb/auth";
import { db } from "@/lib/instantdb/config";
import { createMenuPlan, deleteMenuPlan, updateMenuPlan } from "@/lib/utils/menuPlans";
import { createOrUpdateVote, deleteVote, calculateVoteScore } from "@/lib/utils/votes";
import { updateMenuItem } from "@/lib/utils/menu";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import type { MenuPlan, MenuItem, MealType, MenuVote, VoteValue } from "@/types";

export default function MenuCalendarPage() {
  return (
    <ProtectedRoute>
      <MenuCalendarContent />
    </ProtectedRoute>
  );
}

function MenuCalendarContent() {
  const { user } = useAuth();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMealType, setSelectedMealType] = useState<MealType>("dinner");
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [selectedSideId, setSelectedSideId] = useState("");
  const [editingPlan, setEditingPlan] = useState<MenuPlan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  // Query menu plans for selected household
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

  // Query all menu votes (we'll filter by menu plan IDs client-side)
  const votesQuery = db.useQuery({
    menu_votes: {},
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

  // Query entree_sides relationships
  const entreeSidesQuery = db.useQuery({
    entree_sides: {},
  });

  const householdMembers = membersQuery.data?.household_members || [];
  const allHouseholds = householdsQuery.data?.households || [];
  const menuItems = menuItemsQuery.data?.menu_items || [];
  const allMenuPlans = menuPlansQuery.data?.menu_plans || [];
  const allVotes = votesQuery.data?.menu_votes || [];
  const allSides = sidesQuery.data?.sides || [];
  const allEntreeSides = entreeSidesQuery.data?.entree_sides || [];

  // Get votes for menu plans in the selected household
  const menuPlanIds = new Set(allMenuPlans.map((p: any) => p.id));
  const relevantVotes = allVotes.filter((v: any) => menuPlanIds.has(v.menu_plan_id));

  const isLoading =
    membersQuery.isLoading ||
    householdsQuery.isLoading ||
    menuItemsQuery.isLoading ||
    menuPlansQuery.isLoading ||
    votesQuery.isLoading ||
    sidesQuery.isLoading ||
    entreeSidesQuery.isLoading;

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

  // Get menu plan for a specific date and meal type
  const getMenuPlan = (date: string, mealType: MealType): MenuPlan | undefined => {
    return allMenuPlans.find(
      (plan: any) => plan.date === date && plan.meal_type === mealType
    ) as MenuPlan | undefined;
  };

  // Get menu item for a menu plan
  const getMenuItem = (menuItemId: string): MenuItem | undefined => {
    return menuItems.find((mi: any) => mi.id === menuItemId) as MenuItem | undefined;
  };

  // Get side for a menu plan
  const getSide = (sideId: string | undefined) => {
    if (!sideId) return undefined;
    return allSides.find((s: any) => s.id === sideId);
  };

  // Get available sides for a menu item
  const getAvailableSidesForMenuItem = (menuItemId: string) => {
    if (!menuItemId) return [];
    const entreeSideIds = allEntreeSides
      .filter((es: any) => es.entree_id === menuItemId)
      .map((es: any) => es.side_id);
    return allSides.filter((s: any) => entreeSideIds.includes(s.id));
  };

  // Get votes for a menu plan
  const getVotesForPlan = (menuPlanId: string): MenuVote[] => {
    return relevantVotes.filter((v: any) => v.menu_plan_id === menuPlanId) as MenuVote[];
  };

  // Get user's vote for a menu plan
  const getUserVote = (menuPlanId: string): MenuVote | undefined => {
    if (!user) return undefined;
    return relevantVotes.find(
      (v: any) => v.menu_plan_id === menuPlanId && v.user_id === user.id
    ) as MenuVote | undefined;
  };

  // Handle voting on a menu plan
  const handleVote = async (planId: string, voteValue: VoteValue) => {
    if (!user) return;

    setError("");
    setLoading(true);

    try {
      const existingVote = getUserVote(planId);

      if (existingVote) {
        // If user already voted the same way, remove the vote
        if (existingVote.vote === voteValue) {
          await deleteVote(existingVote.id);
        } else {
          // Create new vote with opposite value
          await createOrUpdateVote({
            menuPlanId: planId,
            userId: user.id,
            vote: voteValue,
          });
          // Delete old vote
          await deleteVote(existingVote.id);
        }
      } else {
        // Create new vote
        await createOrUpdateVote({
          menuPlanId: planId,
          userId: user.id,
          vote: voteValue,
        });
      }

      // Update menu item popularity score
      const plan = allMenuPlans.find((p: any) => p.id === planId);
      if (plan) {
        // Recalculate votes after a brief delay to allow DB to update
        setTimeout(async () => {
          const itemPlans = allMenuPlans.filter((p: any) => p.menu_item_id === plan.menu_item_id);
          let totalScore = 0;
          
          // Get fresh votes
          const freshVotes = allVotes.filter((v: any) => 
            itemPlans.some((p: any) => p.id === v.menu_plan_id)
          );
          
          // Group votes by menu plan
          const votesByPlan = new Map<string, MenuVote[]>();
          freshVotes.forEach((v: any) => {
            if (!votesByPlan.has(v.menu_plan_id)) {
              votesByPlan.set(v.menu_plan_id, []);
            }
            votesByPlan.get(v.menu_plan_id)!.push(v as MenuVote);
          });
          
          // Calculate total score
          votesByPlan.forEach((votes) => {
            totalScore += calculateVoteScore(votes);
          });

          // Get household to check popularity threshold
          const household = allHouseholds.find((h: any) => h.id === plan.household_id);
          const threshold = household?.popularity_threshold ?? -5;

          // Update menu item popularity score and is_hidden based on threshold
          await updateMenuItem(plan.menu_item_id, {
            popularity_score: totalScore,
            is_hidden: totalScore < threshold,
          });
        }, 100);
      }
    } catch (err: any) {
      setError(err.message || "Failed to vote");
    } finally {
      setLoading(false);
    }
  };

  // Get dates for current week
  const getWeekDates = (): Date[] => {
    const dates: Date[] = [];
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Get dates for current month
  const getMonthDates = (): Date[] => {
    const dates: Date[] = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Format date to YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  // Format date for display
  const formatDateDisplay = (date: Date): string => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Navigate to previous week/month
  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  // Navigate to next week/month
  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Navigate to today
  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // Open add modal
  const openAddModal = (date: string, mealType: MealType) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setSelectedMenuItemId("");
    setSelectedSideId("");
    setEditingPlan(null);
    setShowAddModal(true);
  };

  // Open edit modal
  const openEditModal = (plan: MenuPlan) => {
    setEditingPlan(plan);
    setSelectedDate(plan.date);
    setSelectedMealType(plan.meal_type);
    setSelectedMenuItemId(plan.menu_item_id);
    setSelectedSideId(plan.side_id || "");
    setShowAddModal(true);
  };

  // Handle create/update menu plan
  const handleSaveMenuPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedHouseholdId) return;

    setError("");
    setLoading(true);

    try {
      if (!selectedMenuItemId) {
        throw new Error("Please select a menu item");
      }

      if (editingPlan) {
        await updateMenuPlan(editingPlan.id, {
          date: selectedDate,
          menu_item_id: selectedMenuItemId,
          meal_type: selectedMealType,
          side_id: selectedSideId || undefined,
        });
      } else {
        await createMenuPlan({
          householdId: selectedHouseholdId,
          date: selectedDate,
          menuItemId: selectedMenuItemId,
          mealType: selectedMealType,
          userId: user.id,
          sideId: selectedSideId || undefined,
        });
      }

      setShowAddModal(false);
      setSelectedDate("");
      setSelectedMenuItemId("");
      setSelectedSideId("");
      setEditingPlan(null);
    } catch (err: any) {
      setError(err.message || "Failed to save menu plan");
    } finally {
      setLoading(false);
    }
  };

  // Handle delete menu plan
  const handleDeleteMenuPlan = async (planId: string) => {
    if (!confirm("Are you sure you want to remove this menu item from the calendar?")) return;

    setError("");
    setLoading(true);

    try {
      await deleteMenuPlan(planId);
    } catch (err: any) {
      setError(err.message || "Failed to delete menu plan");
    } finally {
      setLoading(false);
    }
  };

  // Handle moving menu item to a new date and/or meal type
  const handleMoveMenuPlan = async (planId: string, newDate: string, newMealType: MealType) => {
    setError("");
    setLoading(true);

    try {
      const plan = allMenuPlans.find((p: any) => p.id === planId);
      if (!plan) {
        throw new Error("Menu plan not found");
      }

      // Check if target location already has a menu plan
      const existingPlan = getMenuPlan(newDate, newMealType);
      if (existingPlan && existingPlan.id !== planId) {
        // Swap the items
        await updateMenuPlan(planId, {
          date: newDate,
          meal_type: newMealType,
        });
        await updateMenuPlan(existingPlan.id, {
          date: plan.date,
          meal_type: plan.meal_type,
        });
      } else {
        // Just move the item
        await updateMenuPlan(planId, {
          date: newDate,
          meal_type: newMealType,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to move menu item");
    } finally {
      setLoading(false);
    }
  };

  const mealTypes: MealType[] = ["breakfast", "lunch", "dinner"];
  const mealTypeLabels: Record<MealType, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
  };

  const menuItemOptions = [
    { value: "", label: "None - Select a menu item" },
    ...menuItems.map((mi: any) => ({
      value: mi.id,
      label: `${mi.name} (${mi.genre})`,
    })),
  ];

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
          <h1 className="text-3xl font-bold mb-8 text-primary">Menu Calendar</h1>
          <Card className="text-center py-12">
            <p className="text-gray-400 mb-4">You&apos;re not part of any households yet.</p>
            <p className="text-sm text-gray-500 mb-4">
              Join or create a household to start planning menus.
            </p>
            <Button onClick={() => (window.location.href = "/household")}>
              Go to Households
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const dates = viewMode === "week" ? getWeekDates() : getMonthDates();
  const currentMonthYear = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const weekStart = dates[0];
  const weekEnd = dates[dates.length - 1];
  const weekRange =
    viewMode === "week"
      ? `${formatDateDisplay(weekStart)} - ${formatDateDisplay(weekEnd)}`
      : currentMonthYear;

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Menu Calendar</h1>
          <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
            <div className="flex gap-2">
              <Button
                variant={viewMode === "week" ? "primary" : "outline"}
                size="sm"
                onClick={() => setViewMode("week")}
              >
                Week
              </Button>
              <Button
                variant={viewMode === "month" ? "primary" : "outline"}
                size="sm"
                onClick={() => setViewMode("month")}
              >
                Month
              </Button>
            </div>
            {userHouseholds.length > 1 && (
              <select
                value={selectedHouseholdId || ""}
                onChange={(e) => setSelectedHouseholdId(e.target.value)}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-secondary-light border border-secondary-lighter rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
              >
                {userHouseholds.map((household: any) => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* Calendar Navigation */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={navigatePrevious} className="flex-1 sm:flex-initial">
              ← Prev
            </Button>
            <Button variant="outline" size="sm" onClick={navigateToday} className="flex-1 sm:flex-initial">
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext} className="flex-1 sm:flex-initial">
              Next →
            </Button>
          </div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-center sm:text-left">{weekRange}</h2>
        </div>

        {/* Calendar Grid - Desktop view */}
        <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-6 md:mx-0 px-4 sm:px-6 md:px-0">
          {viewMode === "week" ? (
            <WeekView
              dates={dates}
              mealTypes={mealTypes}
              mealTypeLabels={mealTypeLabels}
              getMenuPlan={getMenuPlan}
              getMenuItem={getMenuItem}
              getSide={getSide}
              getVotesForPlan={getVotesForPlan}
              getUserVote={getUserVote}
              handleVote={handleVote}
              openAddModal={openAddModal}
              openEditModal={openEditModal}
              handleDeleteMenuPlan={handleDeleteMenuPlan}
              handleMoveMenuPlan={handleMoveMenuPlan}
              formatDate={formatDate}
              formatDateDisplay={formatDateDisplay}
              loading={loading}
            />
          ) : (
            <MonthView
              dates={dates}
              mealTypes={mealTypes}
              mealTypeLabels={mealTypeLabels}
              getMenuPlan={getMenuPlan}
              getMenuItem={getMenuItem}
              getSide={getSide}
              getVotesForPlan={getVotesForPlan}
              openAddModal={openAddModal}
              openEditModal={openEditModal}
              handleDeleteMenuPlan={handleDeleteMenuPlan}
              handleMoveMenuPlan={handleMoveMenuPlan}
              formatDate={formatDate}
              formatDateDisplay={formatDateDisplay}
              currentDate={currentDate}
            />
          )}
        </div>

        {/* Mobile Slide View */}
        {viewMode === "week" && (
          <div className="md:hidden">
            <WeekSlideView
              dates={dates}
              mealTypes={mealTypes}
              mealTypeLabels={mealTypeLabels}
              getMenuPlan={getMenuPlan}
              getMenuItem={getMenuItem}
              getSide={getSide}
              getVotesForPlan={getVotesForPlan}
              getUserVote={getUserVote}
              handleVote={handleVote}
              openAddModal={openAddModal}
              openEditModal={openEditModal}
              handleDeleteMenuPlan={handleDeleteMenuPlan}
              formatDate={formatDate}
              formatDateDisplay={formatDateDisplay}
              loading={loading}
            />
          </div>
        )}

        {/* Mobile Month View */}
        {viewMode === "month" && (
          <div className="md:hidden overflow-x-auto -mx-4 px-4">
            <MonthView
              dates={dates}
              mealTypes={mealTypes}
              mealTypeLabels={mealTypeLabels}
              getMenuPlan={getMenuPlan}
              getMenuItem={getMenuItem}
              getSide={getSide}
              getVotesForPlan={getVotesForPlan}
              openAddModal={openAddModal}
              openEditModal={openEditModal}
              handleDeleteMenuPlan={handleDeleteMenuPlan}
              handleMoveMenuPlan={handleMoveMenuPlan}
              formatDate={formatDate}
              formatDateDisplay={formatDateDisplay}
              currentDate={currentDate}
            />
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">
                {editingPlan ? "Edit Menu Plan" : "Add Menu Item"}
              </h2>
              <form onSubmit={handleSaveMenuPlan}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-4 py-2 bg-secondary-light border border-secondary-lighter rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <Select
                    label="Meal Type"
                    value={selectedMealType}
                    onChange={(e) => setSelectedMealType(e.target.value as MealType)}
                    options={mealTypes.map((mt) => ({
                      value: mt,
                      label: mealTypeLabels[mt],
                    }))}
                    required
                  />
                  {menuItems.length > 0 ? (
                    <>
                      <Select
                        label="Menu Item"
                        value={selectedMenuItemId}
                        onChange={(e) => {
                          setSelectedMenuItemId(e.target.value);
                          // Reset side selection when menu item changes
                          setSelectedSideId("");
                        }}
                        options={menuItemOptions}
                        required
                      />
                      {selectedMenuItemId && (() => {
                        const availableSides = getAvailableSidesForMenuItem(selectedMenuItemId);
                        if (availableSides.length > 0) {
                          const sideOptions = [
                            { value: "", label: "None - No side" },
                            ...availableSides.map((side: any) => ({
                              value: side.id,
                              label: side.name,
                            })),
                          ];
                          return (
                            <Select
                              label="Side (Optional)"
                              value={selectedSideId}
                              onChange={(e) => setSelectedSideId(e.target.value)}
                              options={sideOptions}
                            />
                          );
                        }
                        return null;
                      })()}
                    </>
                  ) : (
                    <div className="text-sm text-gray-400 text-center py-4">
                      No menu items available.{" "}
                      <a href="/menu" className="text-primary hover:underline">
                        Create menu items first
                      </a>
                      .
                    </div>
                  )}
                  <div className="flex gap-4">
                    <Button type="submit" disabled={loading || menuItems.length === 0}>
                      {editingPlan ? "Update" : "Add"} Menu Item
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddModal(false);
                        setEditingPlan(null);
                        setSelectedDate("");
                        setSelectedMenuItemId("");
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
      </div>
    </div>
  );
}

// Mobile Week Slide View Component - Swipeable
function WeekSlideView({
  dates,
  mealTypes,
  mealTypeLabels,
  getMenuPlan,
  getMenuItem,
  getSide,
  getVotesForPlan,
  getUserVote,
  handleVote,
  openAddModal,
  openEditModal,
  handleDeleteMenuPlan,
  formatDate,
  formatDateDisplay,
  loading,
}: {
  dates: Date[];
  mealTypes: MealType[];
  mealTypeLabels: Record<MealType, string>;
  getMenuPlan: (date: string, mealType: MealType) => MenuPlan | undefined;
  getMenuItem: (menuItemId: string) => MenuItem | undefined;
  getSide: (sideId: string | undefined) => any;
  getVotesForPlan: (menuPlanId: string) => MenuVote[];
  getUserVote: (menuPlanId: string) => MenuVote | undefined;
  handleVote: (planId: string, vote: VoteValue) => Promise<void>;
  openAddModal: (date: string, mealType: MealType) => void;
  openEditModal: (plan: MenuPlan) => void;
  handleDeleteMenuPlan: (planId: string) => void;
  formatDate: (date: Date) => string;
  formatDateDisplay: (date: Date) => string;
  loading: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px) to trigger navigation
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentIndex < dates.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentDate = dates[currentIndex];
  const dateStr = formatDate(currentDate);
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayIndex = currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;

  return (
    <div className="w-full">
      {/* Day Indicator */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 bg-secondary-light border border-secondary-lighter rounded-lg disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          aria-label="Previous day"
        >
          ←
        </button>
        <div className="text-center flex-1 mx-4">
          <div className="text-lg font-semibold">{dayNames[dayIndex]}</div>
          <div className="text-sm text-gray-400">{formatDateDisplay(currentDate)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {currentIndex + 1} of {dates.length}
          </div>
        </div>
        <button
          onClick={() => setCurrentIndex(Math.min(dates.length - 1, currentIndex + 1))}
          disabled={currentIndex === dates.length - 1}
          className="px-4 py-2 bg-secondary-light border border-secondary-lighter rounded-lg disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          aria-label="Next day"
        >
          →
        </button>
      </div>

      {/* Swipeable Content */}
      <div
        className="touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        <div className="space-y-4">
          {mealTypes.map((mealType) => {
            const plan = getMenuPlan(dateStr, mealType);
            const menuItem = plan ? getMenuItem(plan.menu_item_id) : null;

            return (
              <Card key={mealType} className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-primary">{mealTypeLabels[mealType]}</h3>
                  {!plan && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAddModal(dateStr, mealType)}
                    >
                      + Add
                    </Button>
                  )}
                </div>

                {plan && menuItem ? (
                  <div className="space-y-3">
                    <div 
                      className="p-3 bg-secondary-lighter rounded-lg cursor-pointer"
                      onClick={() => openEditModal(plan)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-base mb-1">{menuItem.name}</p>
                          <p className="text-sm text-gray-400">{menuItem.genre}</p>
                          {plan.side_id && getSide(plan.side_id) && (
                            <p className="text-xs text-primary mt-1">Side: {getSide(plan.side_id).name}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMenuPlan(plan.id);
                          }}
                          className="text-red-500 text-xl touch-manipulation px-2 py-1 hover:bg-red-500/20 rounded"
                          aria-label="Delete"
                        >
                          ×
                        </button>
                      </div>

                      {/* Voting UI */}
                      <div className="flex items-center justify-center gap-3 pt-2 border-t border-secondary-lighter" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleVote(plan.id, 1)}
                          disabled={loading}
                          className={`flex items-center justify-center px-4 py-3 rounded-lg text-base transition-colors touch-manipulation min-w-[60px] h-[50px] ${
                            getUserVote(plan.id)?.vote === 1
                              ? "bg-green-500/20 text-green-400 border-2 border-green-500/30"
                              : "bg-secondary-light hover:bg-secondary-lighter active:bg-secondary-lighter text-gray-400"
                          }`}
                          title="Upvote"
                          aria-label="Upvote"
                        >
                          ▲
                        </button>
                        <span className="text-lg text-gray-400 min-w-[40px] text-center font-semibold">
                          {calculateVoteScore(getVotesForPlan(plan.id))}
                        </span>
                        <button
                          onClick={() => handleVote(plan.id, -1)}
                          disabled={loading}
                          className={`flex items-center justify-center px-4 py-3 rounded-lg text-base transition-colors touch-manipulation min-w-[60px] h-[50px] ${
                            getUserVote(plan.id)?.vote === -1
                              ? "bg-red-500/20 text-red-400 border-2 border-red-500/30"
                              : "bg-secondary-light hover:bg-secondary-lighter active:bg-secondary-lighter text-gray-400"
                          }`}
                          title="Downvote"
                          aria-label="Downvote"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openAddModal(dateStr, mealType)}
                    className="w-full py-8 text-gray-500 hover:text-primary hover:bg-secondary-light/50 active:bg-secondary-light rounded-lg transition-colors text-base touch-manipulation border-2 border-dashed border-secondary-lighter"
                  >
                    + Add {mealTypeLabels[mealType]}
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Swipe Indicator */}
      <div className="mt-4 flex justify-center gap-2">
        {dates.map((_, idx) => (
          <div
            key={idx}
            className={`h-2 rounded-full transition-all ${
              idx === currentIndex ? "w-8 bg-primary" : "w-2 bg-secondary-lighter"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Week View Component
function WeekView({
  dates,
  mealTypes,
  mealTypeLabels,
  getMenuPlan,
  getMenuItem,
  getSide,
  getVotesForPlan,
  getUserVote,
  handleVote,
  openAddModal,
  openEditModal,
  handleDeleteMenuPlan,
  handleMoveMenuPlan,
  formatDate,
  formatDateDisplay,
  loading,
}: {
  dates: Date[];
  mealTypes: MealType[];
  mealTypeLabels: Record<MealType, string>;
  getMenuPlan: (date: string, mealType: MealType) => MenuPlan | undefined;
  getMenuItem: (menuItemId: string) => MenuItem | undefined;
  getSide: (sideId: string | undefined) => any;
  getVotesForPlan: (menuPlanId: string) => MenuVote[];
  getUserVote: (menuPlanId: string) => MenuVote | undefined;
  handleVote: (planId: string, vote: VoteValue) => Promise<void>;
  openAddModal: (date: string, mealType: MealType) => void;
  openEditModal: (plan: MenuPlan) => void;
  handleDeleteMenuPlan: (planId: string) => void;
  handleMoveMenuPlan: (planId: string, newDate: string, newMealType: MealType) => Promise<void>;
  formatDate: (date: Date) => string;
  formatDateDisplay: (date: Date) => string;
  loading: boolean;
}) {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ date: string; mealType: MealType } | null>(null);

  const handleDragStart = (e: React.DragEvent, planId: string) => {
    setDraggedPlanId(planId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", planId);
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedPlanId(null);
    setDragOverCell(null);
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const handleDragOver = (e: React.DragEvent, date: string, mealType: MealType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell({ date, mealType });
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string, targetMealType: MealType) => {
    e.preventDefault();
    setDragOverCell(null);
    
    const planId = e.dataTransfer.getData("text/plain");
    if (!planId) return;

    const plan = getMenuPlan(targetDate, targetMealType);
    // Don't do anything if dropping on the same location
    if (plan && plan.id === planId) {
      return;
    }

    await handleMoveMenuPlan(planId, targetDate, targetMealType);
    setDraggedPlanId(null);
  };

  return (
    <div className="border border-secondary-lighter rounded-lg overflow-hidden">
      <div className="grid grid-cols-8 bg-secondary-light min-w-[600px] sm:min-w-[640px]">
        <div className="p-3 sm:p-3 md:p-4 border-r border-secondary-lighter font-semibold text-sm sm:text-sm md:text-base sticky left-0 z-10 bg-secondary-light">Meal</div>
        {dates.map((date, idx) => {
          // Get day of week (0 = Sunday, 6 = Saturday)
          // Adjust to Monday = 0
          const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
          return (
            <div
              key={idx}
              className="p-3 sm:p-3 md:p-4 border-r border-secondary-lighter text-center font-semibold last:border-r-0 text-sm sm:text-sm md:text-base"
            >
              <div className="hidden sm:block">{dayNames[dayIndex]}</div>
              <div className="sm:hidden">{dayNames[dayIndex].charAt(0)}</div>
              <div className="text-xs sm:text-xs text-gray-400 hidden sm:block mt-0.5">{formatDateDisplay(date)}</div>
            </div>
          );
        })}
      </div>
      {mealTypes.map((mealType) => (
        <div key={mealType} className="grid grid-cols-8 border-t border-secondary-lighter min-w-[600px] sm:min-w-[640px]">
          <div className="p-3 sm:p-3 md:p-4 border-r border-secondary-lighter bg-secondary-light font-medium text-sm sm:text-sm md:text-base sticky left-0 z-10">
            <span className="hidden sm:inline">{mealTypeLabels[mealType]}</span>
            <span className="sm:hidden">{mealTypeLabels[mealType].charAt(0)}</span>
          </div>
          {dates.map((date, idx) => {
            const dateStr = formatDate(date);
            const plan = getMenuPlan(dateStr, mealType);
            const menuItem = plan ? getMenuItem(plan.menu_item_id) : null;
            const isDragOver = dragOverCell?.date === dateStr && dragOverCell?.mealType === mealType;
            const isDragging = draggedPlanId !== null;

            return (
              <div
                key={idx}
                className={`p-2 sm:p-1.5 md:p-2 border-r border-secondary-lighter last:border-r-0 min-h-[120px] sm:min-h-[95px] md:min-h-[100px] transition-colors ${
                  isDragOver
                    ? "bg-primary/20 border-2 border-primary border-dashed"
                    : isDragging
                    ? "hover:bg-primary/10"
                    : "hover:bg-secondary-light/50"
                }`}
                onDragOver={(e) => handleDragOver(e, dateStr, mealType)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateStr, mealType)}
              >
                {plan && menuItem ? (
                  <div className="group h-full flex flex-col">
                    <Card 
                      className={`p-2.5 sm:p-2 h-full flex flex-col gap-2 ${
                        draggedPlanId === plan.id ? "opacity-50" : ""
                      }`}
                    >
                      <div 
                        className="flex justify-between items-start gap-2 cursor-move relative"
                        draggable
                        onDragStart={(e) => {
                          // Only allow drag if not clicking on a button
                          const target = e.target as HTMLElement;
                          if (target.tagName === 'BUTTON' || target.closest('button')) {
                            e.preventDefault();
                            return;
                          }
                          handleDragStart(e, plan.id);
                        }}
                        onDragEnd={handleDragEnd}
                        title="Drag to move to another day or meal time"
                      >
                        <div 
                          className="flex-1 cursor-pointer min-w-0"
                          onClick={() => openEditModal(plan)}
                        >
                          <p className="font-medium text-sm sm:text-xs md:text-sm truncate leading-snug mb-0.5">{menuItem.name}</p>
                          <p className="text-xs sm:text-xs text-gray-400 hidden sm:block">{menuItem.genre}</p>
                          {plan.side_id && getSide(plan.side_id) && (
                            <p className="text-xs text-primary mt-0.5 hidden sm:block">Side: {getSide(plan.side_id).name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 text-xs opacity-0 md:group-hover:opacity-100 transition-opacity select-none" title="Drag to move">
                            ⋮⋮
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMenuPlan(plan.id);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-red-500 text-lg sm:text-base md:text-xs touch-manipulation flex-shrink-0 w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center rounded hover:bg-red-500/20"
                            aria-label="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      
                      {/* Voting UI - Touch-friendly */}
                      <div className="flex items-center justify-center gap-2 sm:gap-1 mt-auto" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleVote(plan.id, 1)}
                          onMouseDown={(e) => e.stopPropagation()}
                          disabled={loading}
                          className={`flex items-center justify-center px-3 py-2 sm:px-2 sm:py-1 md:px-2 md:py-1 rounded-md text-sm sm:text-xs md:text-xs transition-colors touch-manipulation min-w-[44px] sm:min-w-[32px] md:min-w-0 h-[44px] sm:h-auto ${
                            getUserVote(plan.id)?.vote === 1
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-secondary-lighter hover:bg-secondary-light active:bg-secondary-light text-gray-400"
                          }`}
                          title="Upvote"
                          aria-label="Upvote"
                        >
                          <span className="text-base sm:text-sm md:text-xs">▲</span>
                        </button>
                        <span className="text-sm sm:text-xs text-gray-400 min-w-[28px] sm:min-w-[20px] text-center font-semibold">
                          {calculateVoteScore(getVotesForPlan(plan.id))}
                        </span>
                        <button
                          onClick={() => handleVote(plan.id, -1)}
                          onMouseDown={(e) => e.stopPropagation()}
                          disabled={loading}
                          className={`flex items-center justify-center px-3 py-2 sm:px-2 sm:py-1 md:px-2 md:py-1 rounded-md text-sm sm:text-xs md:text-xs transition-colors touch-manipulation min-w-[44px] sm:min-w-[32px] md:min-w-0 h-[44px] sm:h-auto ${
                            getUserVote(plan.id)?.vote === -1
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-secondary-lighter hover:bg-secondary-light active:bg-secondary-light text-gray-400"
                          }`}
                          title="Downvote"
                          aria-label="Downvote"
                        >
                          <span className="text-base sm:text-sm md:text-xs">▼</span>
                        </button>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <button
                      onClick={() => openAddModal(dateStr, mealType)}
                      className="w-full h-full text-gray-500 hover:text-primary hover:bg-secondary-light/50 active:bg-secondary-light rounded transition-colors text-sm sm:text-xs md:text-sm touch-manipulation py-3 sm:py-2 flex items-center justify-center font-medium"
                    >
                      + Add
                    </button>
                    {/* Invisible drop zone overlay for empty cells */}
                    <div 
                      className="absolute inset-0 z-10"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDragOver(e, dateStr, mealType);
                      }}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDrop(e, dateStr, mealType);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Month View Component
function MonthView({
  dates,
  mealTypes,
  mealTypeLabels,
  getMenuPlan,
  getMenuItem,
  getSide,
  getVotesForPlan,
  openAddModal,
  openEditModal,
  handleDeleteMenuPlan,
  handleMoveMenuPlan,
  formatDate,
  formatDateDisplay,
  currentDate,
}: {
  dates: Date[];
  mealTypes: MealType[];
  mealTypeLabels: Record<MealType, string>;
  getMenuPlan: (date: string, mealType: MealType) => MenuPlan | undefined;
  getMenuItem: (menuItemId: string) => MenuItem | undefined;
  getSide: (sideId: string | undefined) => any;
  getVotesForPlan: (menuPlanId: string) => MenuVote[];
  openAddModal: (date: string, mealType: MealType) => void;
  openEditModal: (plan: MenuPlan) => void;
  handleDeleteMenuPlan: (planId: string) => void;
  handleMoveMenuPlan: (planId: string, newDate: string, newMealType: MealType) => Promise<void>;
  formatDate: (date: Date) => string;
  formatDateDisplay: (date: Date) => string;
  currentDate: Date;
}) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ date: string; mealType: MealType } | null>(null);

  const handleDragStart = (e: React.DragEvent, planId: string) => {
    setDraggedPlanId(planId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", planId);
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedPlanId(null);
    setDragOverCell(null);
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const handleDragOver = (e: React.DragEvent, date: string, mealType: MealType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell({ date, mealType });
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string, targetMealType: MealType) => {
    e.preventDefault();
    setDragOverCell(null);
    
    const planId = e.dataTransfer.getData("text/plain");
    if (!planId) return;

    const plan = getMenuPlan(targetDate, targetMealType);
    // Don't do anything if dropping on the same location
    if (plan && plan.id === planId) {
      return;
    }

    await handleMoveMenuPlan(planId, targetDate, targetMealType);
    setDraggedPlanId(null);
  };

  return (
    <div className="border border-secondary-lighter rounded-lg overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-secondary-light">
        {dayNames.map((day) => (
          <div key={day} className="p-4 text-center font-semibold border-r border-secondary-lighter last:border-r-0">
            {day}
          </div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {dates.map((date, idx) => {
          const isCurrentMonth = date.getMonth() === currentMonth;
          const dateStr = formatDate(date);
          const plans = mealTypes.map((mt) => getMenuPlan(dateStr, mt)).filter(Boolean) as MenuPlan[];
          const isDragOver = dragOverCell?.date === dateStr;
          const isDragging = draggedPlanId !== null;

          return (
            <div
              key={idx}
              className={`min-h-[120px] border-r border-b border-secondary-lighter p-2 transition-colors ${
                !isCurrentMonth ? "bg-secondary-lighter/30 opacity-50" : ""
              } ${
                isDragOver
                  ? "bg-primary/20 border-2 border-primary border-dashed"
                  : isDragging
                  ? "hover:bg-primary/10"
                  : ""
              }`}
              onDragOver={(e) => {
                // Allow drop on any meal type for this date
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverCell({ date: dateStr, mealType: mealTypes[0] });
              }}
              onDragLeave={handleDragLeave}
              onDrop={async (e) => {
                e.preventDefault();
                setDragOverCell(null);
                
                const planId = e.dataTransfer.getData("text/plain");
                if (!planId) return;

                // Find the first available meal type, or use the first one
                const targetMealType = mealTypes.find(
                  (mt) => !getMenuPlan(dateStr, mt)
                ) || mealTypes[0];

                const plan = getMenuPlan(dateStr, targetMealType);
                // Don't do anything if dropping on the same location
                if (plan && plan.id === planId) {
                  return;
                }

                await handleMoveMenuPlan(planId, dateStr, targetMealType);
                setDraggedPlanId(null);
              }}
            >
              <div className="text-sm font-medium mb-1">{date.getDate()}</div>
              <div className="space-y-1">
                {plans.map((plan) => {
                  const menuItem = getMenuItem(plan.menu_item_id);
                  if (!menuItem) return null;
                  const voteScore = calculateVoteScore(getVotesForPlan(plan.id));
                  return (
                    <div
                      key={plan.id}
                      className={`text-xs p-1 bg-primary/20 text-primary rounded cursor-move hover:bg-primary/30 flex items-center justify-between gap-1 ${
                        draggedPlanId === plan.id ? "opacity-50" : ""
                      }`}
                      draggable
                      onDragStart={(e) => {
                        // Only allow drag if not clicking on a button
                        const target = e.target as HTMLElement;
                        if (target.tagName === 'BUTTON' || target.closest('button')) {
                          e.preventDefault();
                          return;
                        }
                        handleDragStart(e, plan.id);
                      }}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        // Only open edit modal if not dragging
                        if (draggedPlanId !== plan.id) {
                          openEditModal(plan);
                        }
                      }}
                      title="Drag to move to another day"
                    >
                      <span className="flex-1 truncate">
                        {mealTypeLabels[plan.meal_type]}: {menuItem.name}
                        {plan.side_id && getSide(plan.side_id) && ` + ${getSide(plan.side_id).name}`}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                          voteScore > 0
                            ? "bg-green-500/20 text-green-400"
                            : voteScore < 0
                            ? "bg-red-500/20 text-red-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                        title={`Vote score: ${voteScore}`}
                      >
                        {voteScore > 0 ? "+" : ""}
                        {voteScore}
                      </span>
                    </div>
                  );
                })}
                {plans.length < 3 && (
                  <button
                    onClick={() => {
                      // Find first available meal type
                      const availableMealType = mealTypes.find(
                        (mt) => !getMenuPlan(dateStr, mt)
                      ) || mealTypes[0];
                      openAddModal(dateStr, availableMealType);
                    }}
                    className="text-xs text-gray-500 hover:text-primary"
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
