import { Meal } from '../types';

const API_BASE = '/api';

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const mealAPI = {
  async getAllMeals(week?: number, year?: number): Promise<Meal[]> {
    const params = new URLSearchParams();
    if (week) params.append('week', week.toString());
    if (year) params.append('year', year.toString());
    
    const response = await fetch(`${API_BASE}/meals?${params}`, {
      headers: getAuthHeader()
    });
    if (!response.ok) throw new Error('Fehler beim Laden der Mahlzeiten');
    return response.json();
  },

  async getMeal(day: string, type: string, week?: number, year?: number): Promise<Meal | null> {
    const params = new URLSearchParams();
    if (week) params.append('week', week.toString());
    if (year) params.append('year', year.toString());
    
    const response = await fetch(`${API_BASE}/meals/${day}/${type}?${params}`, {
      headers: getAuthHeader()
    });
    if (!response.ok) throw new Error('Fehler beim Laden der Mahlzeit');
    return response.json();
  },

  async saveMeal(meal: Meal): Promise<Meal> {
    const response = await fetch(`${API_BASE}/meals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(meal),
    });
    if (!response.ok) throw new Error('Fehler beim Speichern der Mahlzeit');
    return response.json();
  },

  async deleteMeal(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/meals/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (!response.ok) throw new Error('Fehler beim Löschen der Mahlzeit');
  },
};