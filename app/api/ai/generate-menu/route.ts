import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { MealType, MenuGenre } from "@/types";

interface MenuItem {
  id: string;
  name: string;
  genre: MenuGenre;
  /** Combined net from calendar (menu_votes per plan) + family app (menu_item_member_votes). */
  popularity_score: number;
  /**
   * When set, used to classify “no votes yet” vs “has votes” (handles net score 0 with real ballots).
   * Older clients omit this and we fall back to popularity_score !== 0.
   */
  has_vote_activity?: boolean;
  /** Net from votes on scheduled menu plans (menu_votes). */
  votes_from_calendar_plans?: number;
  /** Net from household member votes (menu_item_member_votes), e.g. chore-defense. */
  votes_from_member_app?: number;
}

interface Selection {
  day: string;
  mealType: MealType;
  date: string;
}

interface GenerateMenuRequest {
  householdId: string;
  menuItems: MenuItem[];
  selections: Selection[];
  dietaryInstructions?: string;
  genreWeights: Record<MenuGenre, number>;
  excludedMenuItemNames?: string[];
}

interface MenuPlanResponse {
  date: string;
  mealType: MealType;
  menuItemName: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Initialize OpenAI client after checking for API key
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Parse and validate request body
    let body: GenerateMenuRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { menuItems, selections, dietaryInstructions, genreWeights, excludedMenuItemNames = [] } = body;

    // Validate required fields
    if (!genreWeights || typeof genreWeights !== "object") {
      return NextResponse.json(
        { error: "Genre weights are required" },
        { status: 400 }
      );
    }

    if (!menuItems || menuItems.length === 0) {
      return NextResponse.json(
        { error: "No menu items available" },
        { status: 400 }
      );
    }

    if (!selections || selections.length === 0) {
      return NextResponse.json(
        { error: "No meal selections provided" },
        { status: 400 }
      );
    }

    const itemHasVoteActivity = (item: MenuItem): boolean =>
      item.has_vote_activity !== undefined
        ? item.has_vote_activity
        : item.popularity_score !== 0;

    const formatSigned = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

    const formatVotedItemLine = (item: MenuItem): string => {
      const score = item.popularity_score;
      const indicator = score > 0 ? "👍" : score < 0 ? "👎" : "";
      let line = `- ${item.name} (${item.genre}) - Combined net: ${formatSigned(score)} ${indicator}`;
      if (
        item.votes_from_calendar_plans !== undefined &&
        item.votes_from_member_app !== undefined
      ) {
        line += ` (calendar/scheduled meals: ${formatSigned(item.votes_from_calendar_plans)}; family app: ${formatSigned(item.votes_from_member_app)})`;
      }
      return line;
    };

    // Votes come from menu_votes (calendar) and menu_item_member_votes (API); “no votes” = no ballots in either.
    const itemsWithVotes = menuItems.filter((item) => itemHasVoteActivity(item));
    const itemsWithoutVotes = menuItems.filter((item) => !itemHasVoteActivity(item));

    let menuItemsList = "";

    if (itemsWithVotes.length > 0) {
      menuItemsList +=
        "Menu Items with votes (from calendar scheduled meals and/or family app — combined for popularity):\n";
      const sortedItems = [...itemsWithVotes].sort(
        (a, b) => b.popularity_score - a.popularity_score
      );
      menuItemsList += sortedItems.map(formatVotedItemLine).join("\n");
      menuItemsList += "\n\n";
    }

    if (itemsWithoutVotes.length > 0) {
      menuItemsList +=
        "Menu Items (no votes recorded yet in the calendar or family app — equal preference for exploration):\n";
      menuItemsList += itemsWithoutVotes
        .map((item) => `- ${item.name} (${item.genre})`)
        .join("\n");
    }

    const genreWeightsText = Object.entries(genreWeights)
      .map(([genre, weight]) => `${genre}: ${weight}`)
      .join(", ");

    // Validate selections have valid meal types
    const validMealTypes: MealType[] = ["breakfast", "lunch", "dinner"];
    const invalidSelections = selections.filter(
      (s) => !validMealTypes.includes(s.mealType)
    );
    if (invalidSelections.length > 0) {
      return NextResponse.json(
        { error: `Invalid meal type(s) found: ${invalidSelections.map(s => s.mealType).join(", ")}` },
        { status: 400 }
      );
    }

    const selectionsText = selections
      .map((s) => `${s.day} ${s.mealType} (${s.date})`)
      .join(", ");

    // Build excluded items list for the prompt
    let excludedItemsText = "";
    if (excludedMenuItemNames && excludedMenuItemNames.length > 0) {
      excludedItemsText = `\n\nMenu Items to EXCLUDE (recently used in the previous two weeks):
${excludedMenuItemNames.map((name) => `- ${name}`).join("\n")}

IMPORTANT: Do NOT select any of the excluded menu items listed above. These items were already used in the calendar during the two weeks before the week you are generating for.`;
    }

    const hasVotingData = itemsWithVotes.length > 0;
    const votingInstructions = hasVotingData
      ? `\n5. IMPORTANT: Voting data combines (a) votes on scheduled meals in the app calendar and (b) votes from the family/household app. Use the combined net scores and breakdowns to infer preferences:
   - Items listed as having no votes yet have no ballots in either system — prioritize them for variety and discovery when appropriate
   - Items with positive combined scores (👍) are generally liked; prefer higher combined scores over lower ones
   - Items with negative combined scores (👎) are generally disliked — avoid when better options exist
   - A combined score of 0 can still mean real votes that cancelled out; use the per-source breakdown when provided
   - Only use strongly negative items if no better alternatives exist`
      : "";

    const exclusionRequirement = excludedMenuItemNames && excludedMenuItemNames.length > 0
      ? `\n6. DO NOT select any menu items from the exclusion list above - these were recently used in the previous two weeks and should be avoided`
      : "";

    const prompt = `You are a meal planning assistant. Generate menu suggestions based on the following criteria:

Available Menu Items:
${menuItemsList}${excludedItemsText}

Genre Preferences (higher = more likely): ${genreWeightsText}

Dietary Instructions: ${dietaryInstructions || "None specified"}

Meals to Generate:
${selectionsText}

Requirements:
1. Select one menu item from the available list for each meal
2. Consider the genre preferences when selecting items
3. Follow dietary instructions if provided
4. Try to vary the menu items across the week (avoid too much repetition)${votingInstructions}${exclusionRequirement}

Return a JSON array with this exact format:
[
  {
    "date": "YYYY-MM-DD",
    "mealType": "breakfast|lunch|dinner",
    "menuItemName": "exact name from available menu items"
  },
  ...
]

Only return the JSON array, no other text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful meal planning assistant. Always respond with valid JSON arrays only. Return the array directly, not wrapped in an object.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    // Parse the response - OpenAI may return the array directly or wrapped
    let menuPlans: MenuPlanResponse[] = [];
    
    // Helper function to extract and parse JSON array
    const extractArrayFromResponse = (content: string): MenuPlanResponse[] | null => {
      try {
        // Try parsing as JSON first
        const parsed = JSON.parse(content.trim());
        
        // Handle different response formats
        if (Array.isArray(parsed)) {
          return parsed;
        } else if (parsed.menuPlans && Array.isArray(parsed.menuPlans)) {
          return parsed.menuPlans;
        } else if (parsed.plans && Array.isArray(parsed.plans)) {
          return parsed.plans;
        }
      } catch {
        // If direct parsing fails, try to extract array with regex
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          try {
            return JSON.parse(arrayMatch[0]);
          } catch {
            return null;
          }
        }
      }
      return null;
    };

    const extractedPlans = extractArrayFromResponse(responseContent);
    if (!extractedPlans) {
      throw new Error("Invalid JSON response from OpenAI - could not extract menu plans array");
    }
    menuPlans = extractedPlans;

    // Validate and filter results
    const validMenuPlans = menuPlans.filter((plan: MenuPlanResponse) => {
      // Check required fields exist
      if (!plan.date || !plan.mealType || !plan.menuItemName) {
        return false;
      }

      // Validate meal type
      if (!validMealTypes.includes(plan.mealType)) {
        return false;
      }

      // Validate date format (basic check for YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(plan.date)) {
        return false;
      }

      // Verify the menu item exists
      const menuItem = menuItems.find(
        (item) => item.name === plan.menuItemName
      );
      return !!menuItem;
    });

    if (validMenuPlans.length === 0) {
      return NextResponse.json(
        { error: "No valid menu plans generated. Please check that menu items match the selections." },
        { status: 500 }
      );
    }

    // Check if we got plans for all requested selections
    if (validMenuPlans.length < selections.length) {
      console.warn(
        `Generated ${validMenuPlans.length} plans but ${selections.length} were requested`
      );
    }

    return NextResponse.json({
      menuPlans: validMenuPlans,
      count: validMenuPlans.length,
    });
  } catch (error: unknown) {
    console.error("Error generating menu:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate menu";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

