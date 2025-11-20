import { db } from "@/lib/instantdb/config";
import { id } from "@instantdb/react";
import type { AIPreferences, GenreWeights } from "@/types";

export interface AIPreferencesInput {
  dietary_instructions: string;
  genre_weights: GenreWeights;
}

// Note: This function should be called from a client component using db.useQuery
// For server-side, we'd need a different approach
export async function getAIPreferences(
  householdId: string
): Promise<AIPreferences | null> {
  // This is a placeholder - in practice, you'd use db.useQuery in the component
  // For now, we'll handle this in the component itself
  return null;
}

export async function saveAIPreferences(
  householdId: string,
  input: AIPreferencesInput,
  existingPreferencesId?: string
): Promise<string> {
  if (existingPreferencesId) {
    // Update existing preferences
    db.transact([
      db.tx.ai_preferences[existingPreferencesId].update({
        dietary_instructions: input.dietary_instructions,
        genre_weights: JSON.stringify(input.genre_weights),
        updated_at: Date.now(),
      }),
    ]);
    return existingPreferencesId;
  } else {
    // Create new preferences
    const preferenceId = id();
    db.transact([
      db.tx.ai_preferences[preferenceId].update({
        id: preferenceId,
        household_id: householdId,
        dietary_instructions: input.dietary_instructions,
        genre_weights: JSON.stringify(input.genre_weights),
        created_at: Date.now(),
        updated_at: Date.now(),
      }),
    ]);
    return preferenceId;
  }
}

