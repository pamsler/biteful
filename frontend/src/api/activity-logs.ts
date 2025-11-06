const API_BASE = '/api';

export interface ActivityLog {
  id: number;
  user_id: number;
  username: string;
  display_name: string | null;
  action_type: string;
  action_description: string;
  entity_type: string | null;
  entity_id: number | null;
  metadata: any;
  created_at: string;
}

export interface ActivityLogsResponse {
  success: boolean;
  logs: ActivityLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface RecentLogsResponse {
  success: boolean;
  logs: ActivityLog[];
}

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Holt Activity Logs mit Pagination und Filtern
 */
export async function getActivityLogs(
  limit: number = 50,
  offset: number = 0,
  filters?: {
    userId?: number;
    actionType?: string;
    entityType?: string;
  }
): Promise<ActivityLogsResponse> {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());

  if (filters?.userId) params.append('userId', filters.userId.toString());
  if (filters?.actionType) params.append('actionType', filters.actionType);
  if (filters?.entityType) params.append('entityType', filters.entityType);

  const response = await fetch(`${API_BASE}/activity-logs?${params.toString()}`, {
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Fehler beim Laden der Activity Logs');
  }

  return response.json();
}

/**
 * Holt die neuesten Activity Logs (für Popup)
 */
export async function getRecentActivityLogs(limit: number = 10): Promise<ActivityLog[]> {
  const response = await fetch(`${API_BASE}/activity-logs/recent?limit=${limit}`, {
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Fehler beim Laden der neuesten Activity Logs');
  }

  const data = await response.json();
  return data.logs;
}

/**
 * Löscht alte Activity Logs (nur für Admins)
 */
export async function cleanupOldLogs(daysToKeep: number = 90): Promise<{ success: boolean; deletedCount: number }> {
  const response = await fetch(`${API_BASE}/activity-logs/cleanup?days=${daysToKeep}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Fehler beim Löschen alter Activity Logs');
  }

  return response.json();
}
