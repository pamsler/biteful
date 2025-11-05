import { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Target } from 'lucide-react';
import { Layout } from '../components/Layout';
import { nutritionApi, WeeklySummary, NutritionGoals } from '../api/nutrition';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export function NutritionDashboard() {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [currentYear, setCurrentYear] = useState<number>(0);
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalValues, setGoalValues] = useState({
    daily_calories: 2000,
    daily_protein: 50,
    daily_carbs: 250,
    daily_fat: 70,
    daily_fiber: 30
  });

  useEffect(() => {
    const now = new Date();
    const week = getWeekNumber(now);
    const year = now.getFullYear();
    setCurrentWeek(week);
    setCurrentYear(year);
    loadData(week, year);
    loadGoals();
  }, []);

  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  };

  const loadData = async (week: number, year: number) => {
    try {
      setLoading(true);
      const data = await nutritionApi.getWeeklySummary(week, year);
      setSummary(data);
    } catch (error) {
      console.error('Error loading nutrition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGoals = async () => {
    try {
      const data = await nutritionApi.getGoals();
      setGoals(data);
      setGoalValues({
        daily_calories: data.daily_calories,
        daily_protein: data.daily_protein,
        daily_carbs: data.daily_carbs,
        daily_fat: data.daily_fat,
        daily_fiber: data.daily_fiber
      });
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const saveGoals = async () => {
    try {
      await nutritionApi.updateGoals(goalValues);
      await loadGoals();
      setEditingGoals(false);
      alert('Ziele gespeichert!');
    } catch (error) {
      console.error('Error saving goals:', error);
      alert('Fehler beim Speichern');
    }
  };

  const dayLabels: Record<string, string> = {
    monday: 'Mo',
    tuesday: 'Di',
    wednesday: 'Mi',
    thursday: 'Do',
    friday: 'Fr',
    saturday: 'Sa',
    sunday: 'So'
  };

  const dailyChartData = summary ? Object.entries(summary.daily_totals).map(([day, data]) => ({
    name: dayLabels[day] || day,
    Kalorien: Math.round(data.calories),
    Protein: Math.round(data.protein),
    Kohlenhydrate: Math.round(data.carbs),
    Fett: Math.round(data.fat)
  })) : [];

  const macroData = summary ? [
    { name: 'Protein', value: summary.weekly_totals.protein, color: '#3b82f6' },
    { name: 'Kohlenhydrate', value: summary.weekly_totals.carbs, color: '#10b981' },
    { name: 'Fett', value: summary.weekly_totals.fat, color: '#f59e0b' }
  ] : [];

  const goalProgress = summary && goals ? {
    calories: (summary.daily_averages.calories / goals.daily_calories) * 100,
    protein: (summary.daily_averages.protein / goals.daily_protein) * 100,
    carbs: (summary.daily_averages.carbs / goals.daily_carbs) * 100,
    fat: (summary.daily_averages.fat / goals.daily_fat) * 100,
    fiber: (summary.daily_averages.fiber / goals.daily_fiber) * 100
  } : null;

  if (loading) {
    return (
      <Layout title="Ernährung">
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Lade Daten...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Ernährung">

      {/* Actions Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                KW {currentWeek}, {currentYear}
              </span>
            </div>
            <button
              onClick={() => setEditingGoals(!editingGoals)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <Target className="w-5 h-5" />
              Ziele
            </button>
          </div>
        </div>
      </div>

      {/* Goals Editor */}
      {editingGoals && (
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Ernährungsziele bearbeiten
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kalorien (kcal/Tag)
                </label>
                <input
                  type="number"
                  value={goalValues.daily_calories}
                  onChange={(e) => setGoalValues({ ...goalValues, daily_calories: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Protein (g/Tag)
                </label>
                <input
                  type="number"
                  value={goalValues.daily_protein}
                  onChange={(e) => setGoalValues({ ...goalValues, daily_protein: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kohlenhydrate (g/Tag)
                </label>
                <input
                  type="number"
                  value={goalValues.daily_carbs}
                  onChange={(e) => setGoalValues({ ...goalValues, daily_carbs: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fett (g/Tag)
                </label>
                <input
                  type="number"
                  value={goalValues.daily_fat}
                  onChange={(e) => setGoalValues({ ...goalValues, daily_fat: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ballaststoffe (g/Tag)
                </label>
                <input
                  type="number"
                  value={goalValues.daily_fiber}
                  onChange={(e) => setGoalValues({ ...goalValues, daily_fiber: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <button
                onClick={saveGoals}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Speichern
              </button>
              <button
                onClick={() => setEditingGoals(false)}
                className="px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ø Kalorien/Tag</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary?.daily_averages.calories || 0}
                </p>
                {goals && <p className="text-xs text-gray-500">Ziel: {goals.daily_calories}</p>}
              </div>
              <TrendingUp className="w-8 h-8 text-primary-600" />
            </div>
            {goalProgress && (
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full"
                  style={{ width: `${Math.min(goalProgress.calories, 100)}%` }}
                ></div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ø Protein/Tag</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary?.daily_averages.protein || 0}g
                </p>
                {goals && <p className="text-xs text-gray-500">Ziel: {goals.daily_protein}g</p>}
              </div>
            </div>
            {goalProgress && (
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min(goalProgress.protein, 100)}%` }}
                ></div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ø Kohlenhydrate/Tag</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary?.daily_averages.carbs || 0}g
                </p>
                {goals && <p className="text-xs text-gray-500">Ziel: {goals.daily_carbs}g</p>}
              </div>
            </div>
            {goalProgress && (
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${Math.min(goalProgress.carbs, 100)}%` }}
                ></div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ø Fett/Tag</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary?.daily_averages.fat || 0}g
                </p>
                {goals && <p className="text-xs text-gray-500">Ziel: {goals.daily_fat}g</p>}
              </div>
            </div>
            {goalProgress && (
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-600 h-2 rounded-full"
                  style={{ width: `${Math.min(goalProgress.fat, 100)}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Daily Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Tägliche Nährwerte
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Kalorien" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Macro Pie Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Makronährstoff-Verteilung
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={macroData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${Math.round(entry.value)}g`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {macroData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
}
