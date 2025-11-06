import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CalendarNavigatorProps {
  currentWeek: number;
  currentYear: number;
  onWeekChange: (week: number, year: number) => void;
}

export const CalendarNavigator: React.FC<CalendarNavigatorProps> = ({
  currentWeek,
  currentYear,
  onWeekChange,
}) => {
  const { t } = useTranslation();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  const getWeeksInYear = (year: number): number => {
    const lastDay = new Date(year, 11, 31);
    const lastWeek = getWeekNumber(lastDay);
    return lastWeek === 1 ? 52 : lastWeek;
  };

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const isCurrentWeek = (): boolean => {
    const now = new Date();
    const todayWeek = getWeekNumber(now);
    const todayYear = now.getFullYear();
    return currentWeek === todayWeek && currentYear === todayYear;
  };

  const goToToday = () => {
    const now = new Date();
    const week = getWeekNumber(now);
    const year = now.getFullYear();
    onWeekChange(week, year);
  };

  const goToPreviousWeek = () => {
    if (currentWeek > 1) {
      onWeekChange(currentWeek - 1, currentYear);
    } else {
      const prevYear = currentYear - 1;
      const weeksInPrevYear = getWeeksInYear(prevYear);
      onWeekChange(weeksInPrevYear, prevYear);
    }
  };

  const goToNextWeek = () => {
    const weeksInYear = getWeeksInYear(currentYear);
    if (currentWeek < weeksInYear) {
      onWeekChange(currentWeek + 1, currentYear);
    } else {
      onWeekChange(1, currentYear + 1);
    }
  };

  const handleDateSelect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;

    const date = new Date(selectedDate);
    const week = getWeekNumber(date);
    const year = date.getFullYear();
    onWeekChange(week, year);
    setShowDatePicker(false);
    setSelectedDate('');
  };

  const getDateRangeForWeek = () => {
    const simple = new Date(currentYear, 0, 1 + (currentWeek - 1) * 7);
    const dayOfWeek = simple.getDay();
    const ISOweekStart = simple;

    if (dayOfWeek <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }

    const startDate = new Date(ISOweekStart);
    const endDate = new Date(ISOweekStart);
    endDate.setDate(startDate.getDate() + 6);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    };

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 transition-all border border-gray-100 dark:border-gray-700">
        {/* Main Navigation Section */}
        <div className="flex flex-col gap-3">
          {/* Top Section: Info & Actions */}
          <div className="flex items-center justify-between gap-2">
            {/* Date Range Info */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CalendarIcon className="text-primary-600 dark:text-primary-400 flex-shrink-0" size={18} />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                  {getDateRangeForWeek()}
                </p>
                {isCurrentWeek() && (
                  <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded">
                    {t('calendar.thisWeek')}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`p-1.5 sm:p-2 rounded-lg transition text-sm ${
                  showDatePicker
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={t('calendar.selectDate')}
              >
                <CalendarIcon size={16} />
              </button>
              <button
                onClick={goToToday}
                disabled={isCurrentWeek()}
                className="px-2 sm:px-3 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition text-xs sm:text-sm font-medium disabled:cursor-not-allowed"
              >
                {t('calendar.today')}
              </button>
            </div>
          </div>

          {/* Date Picker Modal */}
          {showDatePicker && (
            <div className="bg-primary-50 dark:bg-gray-700 rounded-lg p-3 border border-primary-200 dark:border-primary-700 animate-slideDown">
              <form onSubmit={handleDateSelect} className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200">
                    {t('calendar.jumpToDate')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDatePicker(false);
                      setSelectedDate('');
                    }}
                    className="p-1 hover:bg-white/50 dark:hover:bg-gray-600 rounded transition"
                  >
                    <X size={16} className="text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
                  required
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-1.5 rounded-lg transition text-xs sm:text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <Check size={14} />
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDatePicker(false);
                      setSelectedDate('');
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 py-1.5 rounded-lg transition text-xs sm:text-sm font-medium"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Week Navigation - Compact */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={goToPreviousWeek}
              className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
              title={t('calendar.previousWeek')}
            >
              <ChevronLeft size={18} className="text-gray-700 dark:text-gray-300" />
            </button>

            <div className="px-4 py-1.5 bg-primary-500 dark:bg-primary-600 rounded-lg">
              <span className="text-sm font-bold text-white">
                {t('calendar.week')} {currentWeek} • {currentYear}
              </span>
            </div>

            <button
              onClick={goToNextWeek}
              className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
              title={t('calendar.nextWeek')}
            >
              <ChevronRight size={18} className="text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
