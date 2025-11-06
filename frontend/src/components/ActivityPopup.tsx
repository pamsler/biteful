import { useState, useEffect } from 'react';
import { getRecentActivityLogs, ActivityLog } from '../api/activity-logs';
import { Clock, X, Activity as ActivityIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActivityPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityPopup({ isOpen, onClose }: ActivityPopupProps) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRecentLogs();
    }
  }, [isOpen]);

  const loadRecentLogs = async () => {
    try {
      setLoading(true);
      const recentLogs = await getRecentActivityLogs(10);
      setLogs(recentLogs);
    } catch (err) {
      console.error('Error loading recent activity logs:', err);
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

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min`;
    if (diffHours < 24) return `vor ${diffHours} Std`;

    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
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

  const handleViewAll = () => {
    navigate('/activity-logs');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fadeIn"
        onClick={onClose}
      />

      {/* Popup */}
      <div className="fixed top-20 right-4 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 animate-slideDown max-h-[calc(100vh-6rem)] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Letzte Aktivitäten
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <ActivityIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Keine Aktivitäten vorhanden
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 text-xl mt-0.5">
                      {getActionIcon(log.action_type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-white">
                            <span className="font-medium">{log.display_name || log.username}</span>
                            {' '}
                            <span className="text-gray-600 dark:text-gray-300">
                              {log.action_description}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleViewAll}
            className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium text-sm"
          >
            Alle Aktivitäten anzeigen
          </button>
        </div>
      </div>
    </>
  );
}
