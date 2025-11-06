import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Sun, Moon, LogOut, Menu, RefreshCw, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { ActivityPopup } from './ActivityPopup';
import { useTranslation } from 'react-i18next';

interface TopBarProps {
  title?: string;
  showBackButton?: boolean;
}

export function TopBar({ title, showBackButton = false }: TopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toggleSidebar, isPinned } = useSidebar();
  const [showActivityPopup, setShowActivityPopup] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Burger Menu & Logo & Title */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Burger Menu Button - versteckt auf Desktop wenn Sidebar gepinnt */}
            {!showBackButton && (
              <button
                onClick={toggleSidebar}
                className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ${
                  isPinned ? 'lg:hidden' : ''
                }`}
                title={t('topBar.navigation')}
              >
                <Menu size={24} className="text-gray-700 dark:text-gray-300" />
              </button>
            )}

            {showBackButton ? (
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                ← {t('topBar.back')}
              </button>
            ) : (
              <>
                <ChefHat className="w-8 h-8 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                    {title || 'Meal Planner'}
                  </h1>
                  {user && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {user.displayName || user.username}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Activity Button */}
            <button
              onClick={() => setShowActivityPopup(true)}
              className="p-2 sm:p-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors shadow-md"
              title={t('topBar.activities')}
            >
              <Activity size={20} />
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => window.location.reload()}
              className="p-2 sm:p-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-md"
              title={t('topBar.refresh')}
            >
              <RefreshCw size={20} />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 sm:p-2.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={theme === 'light' ? t('topBar.darkMode') : t('topBar.lightMode')}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 sm:p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-md"
              title={t('topBar.logout')}
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Activity Popup */}
      <ActivityPopup isOpen={showActivityPopup} onClose={() => setShowActivityPopup(false)} />
    </header>
  );
}
