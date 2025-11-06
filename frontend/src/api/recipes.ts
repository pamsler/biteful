const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export interface Recipe {
  id: number;
  name: string;
  description?: string;
  servings: number;
  prep_time?: number;
  cook_time?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  image_path?: string;
  source_url?: string;
  created_by: number;
  creator_name?: string;
  created_at: string;
  updated_at: string;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  ingredient_count?: number;
  step_count?: number;
}

export interface RecipeIngredient {
  id?: number;
  recipe_id?: number;
  ingredient_id?: number;
  ingredient_name?: string;
  icon?: string;
  amount: number;
  unit: string;
  notes?: string;
}

export interface RecipeStep {
  id?: number;
  recipe_id?: number;
  step_number: number;
  instruction: string;
  image_path?: string;
}

export interface CreateRecipeRequest {
  name: string;
  description?: string;
  servings?: number;
  prep_time?: number;
  cook_time?: number;
  difficulty?: string;
  image_path?: string;
  source_url?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

const getAuthToken = () => {
  return localStorage.getItem('token');
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

export const recipeApi = {
  // Get all recipes
  getAll: async (params?: { search?: string; difficulty?: string; created_by?: number }): Promise<Recipe[]> => {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.difficulty) queryParams.append('difficulty', params.difficulty);
    if (params?.created_by) queryParams.append('created_by', params.created_by.toString());

    const url = `${API_URL}/recipes${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) throw new Error('Fehler beim Laden der Rezepte');
    return response.json();
  },

  // Get single recipe
  getById: async (id: number): Promise<Recipe> => {
    const response = await fetch(`${API_URL}/recipes/${id}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Fehler beim Laden des Rezepts');
    return response.json();
  },

  // Create recipe
  create: async (data: CreateRecipeRequest): Promise<Recipe> => {
    const response = await fetch(`${API_URL}/recipes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Fehler beim Erstellen des Rezepts');
    return response.json();
  },

  // Update recipe
  update: async (id: number, data: CreateRecipeRequest): Promise<Recipe> => {
    const response = await fetch(`${API_URL}/recipes/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Fehler beim Aktualisieren des Rezepts');
    return response.json();
  },

  // Delete recipe
  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/recipes/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });

    if (!response.ok) throw new Error('Fehler beim Löschen des Rezepts');
  },

  // Scale recipe
  scale: async (id: number, new_servings: number) => {
    const response = await fetch(`${API_URL}/recipes/${id}/scale`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ new_servings })
    });

    if (!response.ok) throw new Error('Fehler beim Skalieren des Rezepts');
    return response.json();
  },

  // Add recipe to week
  addToWeek: async (id: number, data: {
    day_of_week: string;
    meal_type: string;
    week_number: number;
    year: number;
  }) => {
    const response = await fetch(`${API_URL}/recipes/${id}/add-to-week`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Fehler beim Hinzufügen zum Wochenplan');
    return response.json();
  },

  // Upload image
  uploadImage: async (file: File): Promise<{ imagePath: string }> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_URL}/recipes/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: formData
    });

    if (!response.ok) throw new Error('Fehler beim Hochladen des Bildes');
    return response.json();
  }
};
