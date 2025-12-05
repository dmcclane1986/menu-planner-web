import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { MealType, MenuGenre } from "@/types";

interface MenuItem {
  id: string;
  name: string;
  genre: MenuGenre;
  popularity_score: number;
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

    const { menuItems, selections, dietaryInstructions, genreWeights } = body;

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

    // Build prompt for OpenAI
    // Separate items with votes from items without votes
    const itemsWithVotes = menuItems.filter((item) => item.popularity_score !== 0);
    const itemsWithoutVotes = menuItems.filter((item) => item.popularity_score === 0);

    let menuItemsList = "";
    
    if (itemsWithVotes.length > 0) {
      menuItemsList += "Menu Items with Member Votes (prefer these based on popularity):\n";
      // Sort by popularity score (highest first)
      const sortedItems = [...itemsWithVotes].sort((a, b) => b.popularity_score - a.popularity_score);
      menuItemsList += sortedItems
        .map((item) => {
          const score = item.popularity_score;
          const indicator = score > 0 ? "👍" : score < 0 ? "👎" : "";
          return `- ${item.name} (${item.genre}) - Popularity: ${score > 0 ? "+" : ""}${score} ${indicator}`;
        })
        .join("\n");
      menuItemsList += "\n\n";
    }
    
    if (itemsWithoutVotes.length > 0) {
      menuItemsList += "Menu Items (no votes yet, equal preference):\n";
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

    const hasVotingData = itemsWithVotes.length > 0;
    const votingInstructions = hasVotingData
      ? `\n6. IMPORTANT: Use popularity scores to reflect household member preferences:
   - Items with no votes (0) have highest preference  --prioritize these
   - Items with positive popularity scores (👍) are liked by household members when 0 no votes remain --prioritize these
   - Items with negative popularity scores (👎) are disliked - avoid these when possible
   
   - When no votes are present, prioritize items with no votes (0)
   - When items have votes, strongly prefer higher-scored items over lower-scored ones
   - Only use items with negative scores if no better alternatives exist`
      : "";

    const prompt = `You are a meal planning assistant. Generate menu suggestions based on the following criteria:

Available Menu Items:
${menuItemsList}

Genre Preferences (higher = more likely): ${genreWeightsText}

Dietary Instructions: ${dietaryInstructions || "None specified"}

Meals to Generate:
${selectionsText}

Requirements:
1. Select one menu item from the available list for each meal
2. Consider the genre preferences when selecting items
3. Follow dietary instructions if provided
4. Try to vary the menu items across the week (avoid too much repetition)
5. Consider meal type appropriateness (e.g., breakfast items for breakfast)${votingInstructions}

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

