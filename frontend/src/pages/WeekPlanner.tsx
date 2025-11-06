import { useEffect, useState } from 'react';
import { Calendar, AlertCircle, ChefHat, ShoppingCart } from 'lucide-react';
import { Layout } from '../components/Layout';
import { MealCard } from '../components/MealCard';
import { CalendarNavigator } from '../components/CalendarNavigator';
import { mealAPI } from '../api/meals';
import { shoppingAPI } from '../api/shopping';
import { Meal, DayOfWeek, MealType } from '../types';
import { useTranslation } from 'react-i18next';

// Original type values that match backend expectations
const DAY_KEYS: DayOfWeek[] = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MEAL_TYPE_KEYS: MealType[] = ['Frühstück', 'Mittagessen', 'Abendessen'];

export const WeekPlanner: React.FC = () => {
  const { t } = useTranslation();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [currentYear, setCurrentYear] = useState<number>(0);
  const [shoppingItemsCount, setShoppingItemsCount] = useState<number>(0);
  const [error, setError] = useState('');

  // Helper function to translate day names
  const getDayTranslation = (day: DayOfWeek): string => {
    const dayMap: Record<string, string> = {
      'Montag': t('days.monday'),
      'Dienstag': t('days.tuesday'),
      'Mittwoch': t('days.wednesday'),
      'Donnerstag': t('days.thursday'),
      'Freitag': t('days.friday'),
      'Samstag': t('days.saturday'),
      'Sonntag': t('days.sunday'),
    };
    return dayMap[day] || day;
  };

  // Helper function to translate meal types
  const getMealTypeTranslation = (mealType: MealType): string => {
    const mealMap: Record<string, string> = {
      'Frühstück': t('mealTypes.breakfast'),
      'Mittagessen': t('mealTypes.lunch'),
      'Abendessen': t('mealTypes.dinner'),
    };
    return mealMap[mealType] || mealType;
  };

  useEffect(() => {
    const now = new Date();
    const week = getWeekNumber(now);
    const year = now.getFullYear();
    setCurrentWeek(week);
    setCurrentYear(year);
    loadMeals(week, year);
  }, []);

  const loadMeals = async (week?: number, year?: number) => {
    setLoading(true);
    setError('');
    try {
      // ⚡ Performance: Parallelisiere API Calls mit Promise.all
      const [data, shoppingData] = await Promise.all([
        mealAPI.getAllMeals(week, year),
        shoppingAPI.getCurrentList(week, year)
      ]);

      setMeals(data);
      setShoppingItemsCount(shoppingData.items.length);
    } catch (error: any) {
      console.error('Error loading meals:', error);
      setError(t('weekPlanner.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const getDateForDay = (dayName: DayOfWeek): Date => {
    const dayIndex = DAY_KEYS.indexOf(dayName);
    const date = getDateOfISOWeek(currentWeek, currentYear);
    date.setDate(date.getDate() + dayIndex);
    return date;
  };

  const getDateOfISOWeek = (week: number, year: number): Date => {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const isToday = (dayName: DayOfWeek): boolean => {
    const today = new Date();
    const todayWeek = getWeekNumber(today);
    const todayYear = today.getFullYear();
    if (todayWeek !== currentWeek || todayYear !== currentYear) return false;

    const todayDayName = DAY_KEYS[today.getDay() === 0 ? 6 : today.getDay() - 1];
    return todayDayName === dayName;
  };

  const handleWeekChange = (week: number, year: number) => {
    setCurrentWeek(week);
    setCurrentYear(year);
    loadMeals(week, year);
  };

  const getMealForSlot = (day: DayOfWeek, mealType: MealType): Meal | null => {
    return meals.find(m => m.day_of_week === day && m.meal_type === mealType) || null;
  };

  const handleSaveMeal = async (meal: Meal) => {
    try {
      const mealWithWeek = {
        ...meal,
        week_number: currentWeek,
        year: currentYear,
      };

      const savedMeal = await mealAPI.saveMeal(mealWithWeek);
      setMeals(prev => {
        const filtered = prev.filter(
          m => !(m.day_of_week === meal.day_of_week && m.meal_type === meal.meal_type)
        );
        return [...filtered, savedMeal];
      });
    } catch (error: any) {
      console.error('Error saving meal:', error);
      setError(t('weekPlanner.errorLoading'));
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteMeal = async (id: number) => {
    try {
      await mealAPI.deleteMeal(id);
      setMeals(prev => prev.filter(m => m.id !== id));
    } catch (error: any) {
      console.error('Error deleting meal:', error);
      setError(t('weekPlanner.errorLoading'));
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) {
    return (
      <Layout title={t('weekPlanner.title')}>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary-200 dark:border-gray-700 mx-auto"></div>
              <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-primary-600 dark:border-primary-400 mx-auto absolute top-0 left-1/2 transform -translate-x-1/2"></div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mt-6 font-medium">{t('common.loading')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={t('weekPlanner.title')}>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slideDown">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 mx-4">
            <AlertCircle size={20} />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1">
        {/* Calendar Navigator */}
        <div className="mb-4 sm:mb-6">
          <CalendarNavigator
            currentWeek={currentWeek}
            currentYear={currentYear}
            onWeekChange={handleWeekChange}
          />
        </div>

        {/* Quick Stats */}
        <div className="mb-4 sm:mb-6 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-md p-3 sm:p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Calendar className="text-primary-600 dark:text-primary-400" size={20} />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('calendar.week')}</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{currentWeek}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-md p-3 sm:p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <ChefHat className="text-green-600 dark:text-green-400" size={20} />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('weekPlanner.title')}</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">{meals.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-md p-3 sm:p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('shoppingList.title')}</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">
                  {shoppingItemsCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Meal Grid */}
        <div className="space-y-4 sm:space-y-6">
          {DAY_KEYS.map(day => {
            const dayDate = getDateForDay(day);
            const today = isToday(day);

            return (
              <div
                key={day}
                className={`bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 transition-all border-2 ${
                  today
                    ? 'border-primary-500 dark:border-primary-600 ring-2 ring-primary-200 dark:ring-primary-900'
                    : 'border-transparent'
                }`}
              >
                {/* Day Header - Mobile Optimized */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 pb-2 sm:pb-3 border-b-2 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2 sm:mb-0">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {getDayTranslation(day)}
                    </h2>
                    {today && (
                      <span className="px-2 py-0.5 bg-primary-500 text-white text-xs font-semibold rounded-full">
                        {t('calendar.today')}
                      </span>
                    )}
                  </div>
                  <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    {formatDate(dayDate)}
                  </span>
                </div>

                {/* Meal Cards - Fully Responsive */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {MEAL_TYPE_KEYS.map(mealType => (
                    <MealCard
                      key={`${day}-${mealType}`}
                      day={day}
                      mealType={mealType}
                      mealTypeTranslation={getMealTypeTranslation(mealType)}
                      meal={getMealForSlot(day, mealType)}
                      onSave={handleSaveMeal}
                      onDelete={handleDeleteMeal}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </Layout>
  );
};
