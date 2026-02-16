/** Stałe i typy dla modułu posiłków – eksportowane z osobnego pliku (pliki "use server" tylko async funkcje). */

export const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_PLAN_MEALS: Record<string, MealType[]> = {
  RO: [],
  BB: ["BREAKFAST"],
  HB: ["BREAKFAST", "DINNER"],
  FB: ["BREAKFAST", "LUNCH", "DINNER"],
  AI: ["BREAKFAST", "LUNCH", "DINNER"],
  BB_PLUS: ["BREAKFAST"],
  HB_PLUS: ["BREAKFAST", "DINNER"],
  FB_PLUS: ["BREAKFAST", "LUNCH", "DINNER"],
  UAI: ["BREAKFAST", "LUNCH", "DINNER"],
};

export const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: "Śniadanie",
  LUNCH: "Obiad",
  DINNER: "Kolacja",
};
