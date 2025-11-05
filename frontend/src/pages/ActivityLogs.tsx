import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { getActivityLogs, ActivityLog } from '../api/activity-logs';
import { Clock, Activity, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterActionType, setFilterActionType] = useState('');
  const limit = 10;

  useEffect(() => {
    loadLogs();
  }, [currentPage, filterActionType]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const offset = (currentPage - 1) * limit;

      const filters: any = {};
      if (filterActionType) filters.actionType = filterActionType;

      const result = await getActivityLogs(limit, offset, filters);
      setLogs(result.logs);
      setTotal(result.total);
    } catch (err: any) {
      console.error('Error loading activity logs:', err);
      setError('Fehler beim Laden der Aktivitäten');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min`;
    if (diffHours < 24) return `vor ${diffHours} Std`;
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;

    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('SHOPPING')) return '🛒';
    if (actionType.includes('MEAL')) return '🍽️';
    if (actionType.includes('RECIPE')) return '📖';
    if (actionType.includes('USER')) return '👤';
    return '📋';
  };

  const getActionColor = (actionType: string) => {
    if (actionType.includes('ADD') || actionType.includes('CREATE')) return 'text-green-600 dark:text-green-400';
    if (actionType.includes('REMOVE') || actionType.includes('DELETE')) return 'text-red-600 dark:text-red-400';
    if (actionType.includes('UPDATE') || actionType.includes('EDIT')) return 'text-blue-600 dark:text-blue-400';
    if (actionType.includes('CHECK')) return 'text-purple-600 dark:text-purple-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'SHOPPING_ADD': 'Einkaufsliste: Hinzugefügt',
      'SHOPPING_REMOVE': 'Einkaufsliste: Entfernt',
      'SHOPPING_CHECK': 'Einkaufsliste: Abgehakt',
      'SHOPPING_UNCHECK': 'Einkaufsliste: Reaktiviert',
      'MEAL_CREATE': 'Menüplan: Erstellt',
      'MEAL_UPDATE': 'Menüplan: Bearbeitet',
      'MEAL_DELETE': 'Menüplan: Gelöscht',
      'RECIPE_CREATE': 'Rezept: Erstellt',
      'RECIPE_UPDATE': 'Rezept: Bearbeitet',
      'RECIPE_DELETE': 'Rezept: Gelöscht',
      'USER_LOGIN': 'Benutzer: Angemeldet',
      'USER_LOGOUT': 'Benutzer: Abgemeldet',
    };
    return labels[actionType] || actionType;
  };

  const totalPages = Math.ceil(total / limit);

  const actionTypes = [
    { value: '', label: 'Alle Aktionen' },
    { value: 'SHOPPING_ADD', label: 'Einkaufsliste: Hinzugefügt' },
    { value: 'SHOPPING_REMOVE', label: 'Einkaufsliste: Entfernt' },
    { value: 'SHOPPING_CHECK', label: 'Einkaufsliste: Abgehakt' },
    { value: 'MEAL_CREATE', label: 'Menüplan: Erstellt' },
    { value: 'MEAL_UPDATE', label: 'Menüplan: Bearbeitet' },
    { value: 'MEAL_DELETE', label: 'Menüplan: Gelöscht' },
  ];

  if (loading && logs.length === 0) {
    return (
      <Layout title="Aktivitäten">
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Lade Aktivitäten...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Aktivitäten">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Aktivitätsprotokoll</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{total} Einträge</p>
              </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <select
                value={filterActionType}
                onChange={(e) => {
                  setFilterActionType(e.target.value);
                  setCurrentPage(1);
                }}
                className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                {actionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {logs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Keine Aktivitäten gefunden
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
              Aktivitäten werden hier protokolliert, sobald Aktionen durchgeführt werden.
            </p>
          </div>
        ) : (
          <>
            {/* Activity Timeline */}
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl">
                        {getActionIcon(log.action_type)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {log.display_name || log.username}
                            </span>
                            <span className="text-gray-600 dark:text-gray-300">
                              {log.action_description}
                            </span>
                          </div>

                        </div>

                        {/* Time */}
                        <div className="flex-shrink-0 text-right">
                          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span>{formatDate(log.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Type Badge */}
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getActionColor(log.action_type)} bg-gray-100 dark:bg-gray-700`}>
                          {getActionTypeLabel(log.action_type)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || loading}
                  className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                >
                  <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
                </button>

                <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  Seite {currentPage} von {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || loading}
                  className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                >
                  <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
