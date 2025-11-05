const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export interface NutritionGoals {
  id: number;
  user_id: number;
  daily_calories: number;
  daily_protein: number;
  daily_carbs: number;
  daily_fat: number;
  daily_fiber: number;
  created_at: string;
  updated_at: string;
}

export interface MealNutrition {
  meal_id: number;
  meal_name: string;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
}

export interface DailyNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  meals: Array<{
    type: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }>;
}

export interface WeeklySummary {
  week_number: number;
  year: number;
  daily_totals: Record<string, DailyNutrition>;
  weekly_totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    meal_count: number;
  };
  daily_averages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  goals: NutritionGoals;
  days_with_meals: number;
}

const getAuthToken = () => {
  return localStorage.getItem('token');
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

export const nutritionApi = {
  // Get nutrition goals
  getGoals: async (): Promise<NutritionGoals> => {
    const response = await fetch(`${API_URL}/nutrition/goals`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Fehler beim Laden der Ernährungsziele');
    return response.json();
  },

  // Update nutrition goals
  updateGoals: async (goals: Partial<NutritionGoals>): Promise<NutritionGoals> => {
    const response = await fetch(`${API_URL}/nutrition/goals`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(goals)
    });

    if (!response.ok) throw new Error('Fehler beim Speichern der Ernährungsziele');
    return response.json();
  },

  // Calculate nutrition for meal
  calculateMeal: async (mealId: number): Promise<MealNutrition> => {
    const response = await fetch(`${API_URL}/nutrition/calculate-meal/${mealId}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Fehler beim Berechnen der Nährwerte');
    return response.json();
  },

  // Get weekly summary
  getWeeklySummary: async (week: number, year: number): Promise<WeeklySummary> => {
    const response = await fetch(`${API_URL}/nutrition/weekly-summary/${week}/${year}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Fehler beim Laden der Wochenübersicht');
    return response.json();
  },

  // Sync ingredient nutrition data
  syncIngredient: async (ingredientId: number, data: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }) => {
    const response = await fetch(`${API_URL}/nutrition/sync-ingredient/${ingredientId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Fehler beim Synchronisieren der Nährwerte');
    return response.json();
  }
};
