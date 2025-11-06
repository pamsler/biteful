const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export interface ParsedRecipe {
  name: string;
  servings: number;
  prep_time: number;
  cook_time: number;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  image_path?: string;
  ingredients: Array<{
    ingredient_name: string;
    amount: number;
    amount_min?: number;
    amount_max?: number;
    unit: string;
    notes: string;
  }>;
  steps: Array<{
    step_number: number;
    instruction: string;
  }>;
}

export interface ParsePDFResponse {
  success: boolean;
  method: string; // 'regex', 'ai-claude', 'ai-openai', 'regex-fallback'
  recipe: ParsedRecipe;
  stats: {
    ingredients: number;
    steps: number;
    pdfPages: number;
  };
}

const getAuthToken = () => {
  return localStorage.getItem('token');
};

class PDFRecipesAPI {
  async parsePDF(file: File): Promise<ParsePDFResponse> {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch(`${API_URL}/pdf-recipes/parse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      const error: any = new Error(errorData.details || errorData.error || 'Fehler beim Verarbeiten der PDF');
      error.response = { data: errorData };
      throw error;
    }

    return response.json();
  }
}

export const pdfRecipesApi = new PDFRecipesAPI();
