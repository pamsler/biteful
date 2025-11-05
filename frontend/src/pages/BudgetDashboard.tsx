import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { Layout } from '../components/Layout';
import { budgetApi, WeeklyBudget, BudgetHistory } from '../api/budget';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export function BudgetDashboard() {
  const [budget, setBudget] = useState<WeeklyBudget | null>(null);
  const [history, setHistory] = useState<BudgetHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [currentYear, setCurrentYear] = useState<number>(0);
  const [selectedStore, setSelectedStore] = useState('Coop');
  const [editingLimit, setEditingLimit] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState(200);

  useEffect(() => {
    const now = new Date();
    const week = getWeekNumber(now);
    const year = now.getFullYear();
    setCurrentWeek(week);
    setCurrentYear(year);
    loadData(week, year);
    loadHistory();
  }, [selectedStore]);

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
      const data = await budgetApi.getWeeklyBudget(week, year, selectedStore);
      setBudget(data);
      setBudgetLimit(data.budget_limit);
    } catch (error) {
      console.error('Error loading budget:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await budgetApi.getHistory();
      setHistory(data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const saveBudgetLimit = async () => {
    try {
      await budgetApi.setWeeklyBudgetLimit(currentWeek, currentYear, budgetLimit);
      await loadData(currentWeek, currentYear);
      setEditingLimit(false);
      alert('Budget gespeichert!');
    } catch (error) {
      console.error('Error saving budget:', error);
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

  const mealCostChartData = budget ? budget.meal_costs.map(meal => ({
    name: `${dayLabels[meal.day]} ${meal.type}`,
    Kosten: meal.cost
  })) : [];

  const historyChartData = history.map(h => ({
    name: `KW ${h.week_number}`,
    Budget: h.budget_limit,
    Ausgaben: h.actual_cost
  }));

  if (loading) {
    return (
      <Layout title="Budget">
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
    <Layout title="Budget">

      {/* Actions Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  KW {currentWeek}, {currentYear}
                </span>
              </div>

              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="Coop">Coop</option>
                <option value="Migros">Migros</option>
                <option value="Aldi">Aldi</option>
                <option value="Lidl">Lidl</option>
              </select>
            </div>

            <button
              onClick={() => setEditingLimit(!editingLimit)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <DollarSign className="w-5 h-5" />
              Budget setzen
            </button>
          </div>
        </div>
      </div>

      {/* Budget Limit Editor */}
      {editingLimit && (
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Wöchentliches Budget festlegen
            </h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Budget (CHF)
                </label>
                <input
                  type="number"
                  step="10"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={saveBudgetLimit}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Speichern
              </button>
              <button
                onClick={() => setEditingLimit(false)}
                className="px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400"
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
                <p className="text-sm text-gray-600 dark:text-gray-400">Budget</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  CHF {budget?.budget_limit.toFixed(2) || '0.00'}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-primary-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ausgegeben</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  CHF {budget?.actual_cost.toFixed(2) || '0.00'}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Verbleibend</p>
                <p className={`text-2xl font-bold ${budget?.remaining && budget.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  CHF {budget?.remaining.toFixed(2) || '0.00'}
                </p>
              </div>
              <TrendingUp className={`w-8 h-8 ${budget?.remaining && budget.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Verbraucht</p>
                <p className={`text-2xl font-bold ${budget?.percentage_used && budget.percentage_used > 100 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                  {budget?.percentage_used.toFixed(0) || 0}%
                </p>
              </div>
            </div>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${budget?.is_over_budget ? 'bg-red-600' : 'bg-green-600'}`}
                style={{ width: `${Math.min(budget?.percentage_used || 0, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Alert if over budget */}
        {budget?.is_over_budget && (
          <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">Budget überschritten!</p>
                <p className="text-sm text-red-600 dark:text-red-300">
                  Du hast CHF {Math.abs(budget.remaining).toFixed(2)} über dem Budget ausgegeben.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Meal Costs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Kosten pro Mahlzeit
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mealCostChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => `CHF ${value.toFixed(2)}`} />
                <Bar dataKey="Kosten" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Budget History */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Budget-Verlauf
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => `CHF ${value.toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="Budget" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="Ausgaben" stroke="#6366f1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Meal List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Mahlzeiten dieser Woche
          </h2>
          <div className="space-y-3">
            {budget?.meal_costs.map((meal, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{meal.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {dayLabels[meal.day]} - {meal.type}
                  </p>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  CHF {meal.cost.toFixed(2)}
                </p>
              </div>
            ))}
            {budget?.meal_costs.length === 0 && (
              <p className="text-center text-gray-500 py-8">Keine Mahlzeiten geplant</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
