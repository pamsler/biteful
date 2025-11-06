const API_BASE = '/api';

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const authAPI = {
  async login(username: string, password: string) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) throw new Error('Login fehlgeschlagen');
    return response.json();
  },

  async getSSOAuthUrl() {
    const response = await fetch(`${API_BASE}/auth/sso/auth-url`);
    if (!response.ok) throw new Error('SSO nicht verfügbar');
    return response.json();
  },

  async ssoCallback(code: string) {
    const response = await fetch(`${API_BASE}/auth/sso/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (!response.ok) throw new Error('SSO Login fehlgeschlagen');
    return response.json();
  },

  async verify() {
    const response = await fetch(`${API_BASE}/auth/verify`, {
      headers: getAuthHeader()
    });
    if (!response.ok) throw new Error('Token ungültig');
    return response.json();
  }
};

export const userAPI = {
  async getAll() {
    const response = await fetch(`${API_BASE}/users`, {
      headers: getAuthHeader()
    });
    if (!response.ok) throw new Error('Fehler beim Laden der Benutzer');
    return response.json();
  },

  async create(userData: any) {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(userData)
    });
    if (!response.ok) throw new Error('Fehler beim Erstellen des Benutzers');
    return response.json();
  },

  async update(id: number, userData: any) {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(userData)
    });
    if (!response.ok) throw new Error('Fehler beim Aktualisieren des Benutzers');
    return response.json();
  },

  async resetPassword(id: number, password: string) {
    const response = await fetch(`${API_BASE}/users/${id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ password })
    });
    if (!response.ok) throw new Error('Fehler beim Zurücksetzen des Passworts');
    return response.json();
  },

  async delete(id: number) {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (!response.ok) throw new Error('Fehler beim Löschen des Benutzers');
    return response.json();
  }
};

export const ssoAPI = {
  async getConfig() {
    const response = await fetch(`${API_BASE}/sso`, {
      headers: getAuthHeader()
    });
    if (!response.ok) throw new Error('Fehler beim Laden der SSO Konfiguration');
    return response.json();
  },

  async updateConfig(config: any) {
    const response = await fetch(`${API_BASE}/sso`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Fehler beim Speichern der SSO Konfiguration');
    return response.json();
  },

  async syncUsers() {
    const response = await fetch(`${API_BASE}/sso/sync`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    if (!response.ok) throw new Error('Fehler beim Synchronisieren der Benutzer');
    return response.json();
  },

  async getPublicConfig() {
    const response = await fetch(`${API_BASE}/sso/public`);
    if (!response.ok) return { enabled: false };
    return response.json();
  }
};