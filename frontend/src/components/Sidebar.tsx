import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, ShoppingCart, BookOpen, Pin, X, ChefHat, Settings, Activity, Languages } from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isOpen, isPinned, closeSidebar, togglePin } = useSidebar();
  const { t, i18n } = useTranslation();

  const navItems = [
    { path: '/', icon: Calendar, label: t('sidebar.weekPlanner'), color: 'from-primary-500 to-primary-600' },
    { path: '/shopping', icon: ShoppingCart, label: t('sidebar.shoppingList'), color: 'from-green-500 to-emerald-600' },
    { path: '/recipes', icon: BookOpen, label: t('sidebar.recipes'), color: 'from-orange-500 to-red-600' },
    { path: '/activity-logs', icon: Activity, label: t('sidebar.activities'), color: 'from-purple-500 to-purple-600' },
  ];

  const toggleLanguage = () => {
    const newLang = i18n.language === 'de' ? 'en' : 'de';
    i18n.changeLanguage(newLang);
  };

  const currentLanguage = i18n.language || 'de';

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (!isPinned) {
      closeSidebar();
    }
  };

  return (
    <>
      {/* Overlay für Mobile - nur wenn Sidebar offen und nicht gepinnt */}
      {isOpen && !isPinned && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white dark:bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ease-in-out border-r border-gray-200 dark:border-gray-700 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isPinned ? 'lg:translate-x-0' : ''}`}
        style={{ width: '280px' }}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <ChefHat className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('sidebar.title')}</h2>
            </div>
          </div>

          {/* Close Button für Mobile & Pin Button */}
          <div className="flex items-center gap-1">
            <button
              onClick={togglePin}
              className={`p-2 rounded-lg transition-colors hidden lg:block ${
                isPinned
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={isPinned ? t('sidebar.unpin') : t('sidebar.pin')}
            >
              <Pin size={18} className={isPinned ? 'rotate-45' : ''} />
            </button>
            <button
              onClick={closeSidebar}
              className="lg:hidden p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('sidebar.close')}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {navItems.map(({ path, icon: Icon, label, color }) => (
              <button
                key={path}
                onClick={() => handleNavigate(path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive(path)
                    ? `bg-gradient-to-r ${color} text-white shadow-lg shadow-primary-500/20`
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon size={22} />
                <span className="font-medium">{label}</span>
              </button>
            ))}

            {/* Admin Settings - nur für Admins */}
            {user?.isAdmin && (
              <>
                <div className="my-3 border-t border-gray-300 dark:border-gray-600"></div>
                <button
                  onClick={() => handleNavigate('/settings')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive('/settings')
                      ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg shadow-gray-500/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <Settings size={22} />
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium">{t('sidebar.settings')}</span>
                    <span className="ml-auto text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-md font-semibold">
                      {t('sidebar.admin')}
                    </span>
                  </div>
                </button>
              </>
            )}
          </div>
        </nav>

        {/* Language Toggle - am unteren Rand der Sidebar */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={toggleLanguage}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
          >
            <Languages size={22} />
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {currentLanguage === 'de' ? 'Deutsch' : 'English'}
              </span>
              <span className="text-2xl">
                {currentLanguage === 'de' ? '🇩🇪' : '🇬🇧'}
              </span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
