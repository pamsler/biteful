// ============================================
// MEAL PLANNER TYPES
// ============================================
export interface Meal {
  id?: number;
  day_of_week: string;
  meal_type: string;
  meal_name: string;
  description?: string;
  ingredients?: string;
  week_number: number;
  year: number;
  created_by?: number;
  updated_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export type DayOfWeek = 'Montag' | 'Dienstag' | 'Mittwoch' | 'Donnerstag' | 'Freitag' | 'Samstag' | 'Sonntag';
export type MealType = 'Frühstück' | 'Mittagessen' | 'Abendessen';

// ============================================
// SHOPPING LIST TYPES
// ============================================
export interface IngredientCategory {
  id: number;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

export interface Ingredient {
  id?: number;
  code?: string; // ✅ NEU: OpenFoodFacts Barcode/Product Code
  name: string;
  icon?: string; // ✅ PRODUKT-SPEZIFISCHES ICON!
  category?: string;
  categoryId?: number;
  categoryIcon?: string;
  categoryColor?: string;
  unit?: string;
  image?: string;
  source?: 'local' | 'api' | 'suggestion';
  usageCount?: number;
  country?: string; // '🇨🇭' oder '🌍'
  isSwiss?: boolean;
}

export interface ShoppingListItem {
  id: number;
  shopping_list_id: number;
  meal_id?: number;
  ingredient_id?: number;
  name: string;
  quantity?: number;
  unit?: string;
  category_id?: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  category_sort?: number;
  sort_order?: number;
  is_checked: boolean;
  notes?: string;
  meal_name?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ShoppingList {
  id: number;
  week_number: number;
  year: number;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListResponse {
  list: ShoppingList;
  items: ShoppingListItem[];
}

// ============================================
// AUTH TYPES
// ============================================
export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  auth_type: 'local' | 'sso';
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

// ============================================
// SSO TYPES
// ============================================
export interface SSOConfig {
  id: number;
  is_enabled: boolean;
  tenant_id?: string;
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  button_text?: string;
  allowed_groups?: string[];
  frontend_url?: string;
  last_sync?: string;
  created_at: string;
}