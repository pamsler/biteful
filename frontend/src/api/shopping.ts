import { ShoppingListResponse, ShoppingListItem, Ingredient, IngredientCategory } from '../types';

const API_BASE = '/api';

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const handleAPIError = async (response: Response) => {
  let errorMessage = 'Ein unbekannter Fehler ist aufgetreten';

  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorData.error || errorMessage;
  } catch {
    errorMessage = response.statusText || errorMessage;
  }

  throw new Error(errorMessage);
};

// ============================================
// OPTIMIERTE FETCH-KONFIGURATION
// ============================================
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout: number = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Die Suche dauert länger als erwartet. Bitte haben Sie etwas Geduld...');
    }
    throw error;
  }
};

// ============================================
// SHOPPING API
// ============================================

export const shoppingAPI = {
  async getCurrentList(week?: number, year?: number): Promise<ShoppingListResponse> {
    const params = new URLSearchParams();
    if (week) params.append('week', week.toString());
    if (year) params.append('year', year.toString());

    const response = await fetchWithTimeout(`${API_BASE}/shopping/current?${params}`, {
      headers: getAuthHeader()
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  },

  async addItem(item: {
    name: string;
    ingredient_id?: number;
    image_url?: string;
    week?: number;
    year?: number;
  }): Promise<ShoppingListItem> {
    const response = await fetchWithTimeout(`${API_BASE}/shopping/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(item),
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  },

  async toggleItem(id: number): Promise<ShoppingListItem> {
    const response = await fetchWithTimeout(`${API_BASE}/shopping/items/${id}/toggle`, {
      method: 'PATCH',
      headers: getAuthHeader()
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  },

  async deleteItem(id: number): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/shopping/items/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });

    if (!response.ok) {
      await handleAPIError(response);
    }
  },

  async getRecent(): Promise<Ingredient[]> {
    const response = await fetchWithTimeout(`${API_BASE}/shopping/recent`, {
      headers: getAuthHeader()
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  },

  async addFromMeal(mealId: number, week?: number, year?: number): Promise<{
    success: boolean;
    added: number;
    skipped: number;
    skippedItems: string[];
    message: string;
  }> {
    const response = await fetchWithTimeout(`${API_BASE}/shopping/from-meal/${mealId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ week, year }),
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  },

  async uploadProduct(formData: FormData): Promise<{ success: boolean; ingredient: any; message: string }> {
    const response = await fetchWithTimeout(`${API_BASE}/shopping/items/upload`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    }, 30000); // 30 Sekunden für Upload

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  },
};

// ============================================
// INGREDIENTS API - MIT LANGEM TIMEOUT FÜR OPENFOODFACTS
// ============================================

export const ingredientsAPI = {
  async search(query: string, page: number = 1): Promise<{ 
    results: Ingredient[]; 
    hasMore: boolean; 
    page: number; 
    total: number;
    totalPages: number;
    cached?: boolean;
    apiLimited?: boolean;
    maxPages?: number;
  }> {
    if (!query || query.length < 2) {
      return { results: [], hasMore: false, page: 1, total: 0, totalPages: 0 };
    }

    // ✅ LANGER TIMEOUT: 40 Sekunden für OpenFoodFacts
    const response = await fetchWithTimeout(
      `${API_BASE}/ingredients/search?query=${encodeURIComponent(query)}&page=${page}`, 
      { 
        headers: {
          ...getAuthHeader(),
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      },
      40000 // ✅ 40 Sekunden Timeout
    );

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  },

  async getCategories(): Promise<IngredientCategory[]> {
    const response = await fetchWithTimeout(`${API_BASE}/ingredients/categories`, {
      headers: getAuthHeader()
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  },

  async getFrequent(): Promise<Ingredient[]> {
    const response = await fetchWithTimeout(`${API_BASE}/ingredients/frequent`, {
      headers: getAuthHeader()
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  },

  // ✅ NEU: DELETE INGREDIENT
  async deleteIngredient(id: number): Promise<{ success: boolean; message: string }> {
    const response = await fetchWithTimeout(`${API_BASE}/ingredients/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  },
};