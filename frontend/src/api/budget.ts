const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export interface IngredientPrice {
  id: number;
  ingredient_id: number;
  ingredient_name?: string;
  icon?: string;
  category_name?: string;
  store: string;
  price: number;
  unit: string;
  updated_at: string;
}

export interface MealCost {
  meal_id: number;
  meal_name: string;
  store: string;
  total_cost: number;
  ingredients: Array<{
    ingredient_id: number;
    name: string;
    amount: number;
    unit: string;
    price: number | null;
    price_unit: string | null;
    cost: number;
    has_price_data: boolean;
  }>;
  ingredients_without_price: number;
}

export interface WeeklyBudget {
  week_number: number;
  year: number;
  store: string;
  budget_limit: number;
  actual_cost: number;
  remaining: number;
  percentage_used: number;
  is_over_budget: boolean;
  meal_costs: Array<{
    meal_id: number;
    day: string;
    type: string;
    name: string;
    cost: number;
  }>;
  meal_count: number;
}

export interface BudgetHistory {
  week_number: number;
  year: number;
  budget_limit: number;
  actual_cost: number;
  over_budget: boolean;
}

const getAuthToken = () => {
  return localStorage.getItem('token');
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

export const budgetApi = {
  // Get prices for ingredient
  getPricesByIngredient: async (ingredientId: number): Promise<IngredientPrice[]> => {
    const response = await fetch(`${API_URL}/budget/prices/${ingredientId}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Fehler beim Laden der Preise');
    return response.json();
  },

  // Get all prices
  getAllPrices: async (store?: string): Promise<{ prices: IngredientPrice[]; stores: string[] }> => {
    const url = store ? `${API_URL}/budget/prices?store=${store}` : `${API_URL}/budget/prices`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) throw new Error('Fehler beim Laden der Preise');
    return response.json();
  },

  // Set/update price
  setPrice: async (data: {
    ingredient_id: number;
    store: string;
    price: number;
    unit: string;
  }): Promise<IngredientPrice> => {
    const response = await fetch(`${API_URL}/budget/prices`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Fehler beim Speichern des Preises');
    return response.json();
  },

  // Delete price
  deletePrice: async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/budget/prices/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Fehler beim Löschen des Preises');
  },

  // Calculate meal cost
  calculateMealCost: async (mealId: number, store?: string): Promise<MealCost> => {
    const url = store ? `${API_URL}/budget/calculate-meal/${mealId}?store=${store}` : `${API_URL}/budget/calculate-meal/${mealId}`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) throw new Error('Fehler beim Berechnen der Kosten');
    return response.json();
  },

  // Get weekly budget
  getWeeklyBudget: async (week: number, year: number, store?: string): Promise<WeeklyBudget> => {
    const url = store ? `${API_URL}/budget/weekly/${week}/${year}?store=${store}` : `${API_URL}/budget/weekly/${week}/${year}`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) throw new Error('Fehler beim Laden des Budgets');
    return response.json();
  },

  // Set weekly budget limit
  setWeeklyBudgetLimit: async (week: number, year: number, budget_limit: number): Promise<any> => {
    const response = await fetch(`${API_URL}/budget/weekly/${week}/${year}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ budget_limit })
    });

    if (!response.ok) throw new Error('Fehler beim Speichern des Budgets');
    return response.json();
  },

  // Get budget history
  getHistory: async (): Promise<BudgetHistory[]> => {
    const response = await fetch(`${API_URL}/budget/history`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Fehler beim Laden der Historie');
    return response.json();
  }
};
