const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export interface AISettings {
  provider: 'claude' | 'openai';
  api_key: string;
  enabled: boolean;
  has_api_key: boolean;
  force_autonomous?: boolean;
}

export interface UpdateAISettingsData {
  provider?: 'claude' | 'openai';
  api_key?: string;
  enabled?: boolean;
  force_autonomous?: boolean;
}

const getAuthToken = () => {
  return localStorage.getItem('token');
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

class AISettingsAPI {
  async getSettings(): Promise<AISettings> {
    const response = await fetch(`${API_URL}/ai-settings`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Fehler beim Laden der AI Einstellungen');
    }

    return response.json();
  }

  async updateSettings(data: UpdateAISettingsData): Promise<{ message: string; provider: string; enabled: boolean }> {
    const response = await fetch(`${API_URL}/ai-settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Fehler beim Speichern der AI Einstellungen');
    }

    return response.json();
  }
}

export const aiSettingsApi = new AISettingsAPI();
