import { useState, memo } from 'react';
import { Trash2, Check, X, ShoppingCart, AlertCircle, Loader2, Plus, Info } from 'lucide-react';
import { Meal, MealType } from '../types';
import { shoppingAPI } from '../api/shopping';
import { useTranslation } from 'react-i18next';

interface MealCardProps {
  day: string;
  mealType: MealType;
  mealTypeTranslation: string;
  meal: Meal | null;
  onSave: (meal: Meal) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

// ⚡ Performance: Konstanten außerhalb der Component (werden nur 1x erstellt)
const MEAL_ICONS: Record<MealType, string> = {
  'Frühstück': '🍳',
  'Mittagessen': '🍽️',
  'Abendessen': '🌙'
};

const MEAL_COLORS: Record<MealType, string> = {
  'Frühstück': 'from-yellow-400 to-orange-400',
  'Mittagessen': 'from-blue-400 to-cyan-400',
  'Abendessen': 'from-purple-400 to-pink-400'
};

// ⚡ Performance: Utility-Funktion außerhalb der Component
const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// ⚡ Performance: React.memo verhindert unnötige Re-Renders
const MealCardComponent: React.FC<MealCardProps> = ({ day, mealType, mealTypeTranslation, meal, onSave, onDelete }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [mealName, setMealName] = useState(meal?.meal_name || '');
  const [description, setDescription] = useState(meal?.description || '');
  const [ingredients, setIngredients] = useState(meal?.ingredients || '');
  const [addingToList, setAddingToList] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showWarningToast, setShowWarningToast] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  const showToast = (message: string, isError = false) => {
    if (isError) {
      setErrorMessage(message);
      setShowErrorToast(true);
      setTimeout(() => setShowErrorToast(false), 3000);
    } else {
      setToastMessage(message);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    }
  };

  const handleSave = async () => {
    if (!mealName.trim()) {
      showToast(t('weekPlanner.noMealPlanned'), true);
      return;
    }

    try {
      setSaving(true);
      const now = new Date();
      const weekNumber = getWeekNumber(now);
      const year = now.getFullYear();

      await onSave({
        day_of_week: day,
        meal_type: mealType,
        meal_name: mealName,
        description,
        ingredients,
        week_number: weekNumber,
        year,
      });
      setIsEditing(false);
      showToast(t('common.save'));
    } catch (error) {
      showToast(t('common.error'), true);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setMealName(meal?.meal_name || '');
    setDescription(meal?.description || '');
    setIngredients(meal?.ingredients || '');
    setIsEditing(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Verhindert, dass die Card geklickt wird
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!meal?.id) return;

    try {
      await onDelete(meal.id);
      setShowDeleteModal(false);
      showToast(t('mealCard.delete'));
    } catch (error) {
      showToast(t('common.error'), true);
      setShowDeleteModal(false);
    }
  };

  const handleAddToShoppingList = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Verhindert, dass die Card geklickt wird
    if (!meal?.id) return;

    try {
      setAddingToList(true);
      const result = await shoppingAPI.addFromMeal(meal.id);

      // Zeige Erfolgs-Toast für hinzugefügte Items
      if (result.added > 0) {
        showToast(`${result.added} Zutat${result.added > 1 ? 'en' : ''} zur Einkaufsliste hinzugefügt`);
      }

      // Zeige Warn-Toast für übersprungene Items
      if (result.skipped > 0 && result.skippedItems.length > 0) {
        const skippedList = result.skippedItems.slice(0, 3).join(', ');
        const moreText = result.skippedItems.length > 3 ? ` und ${result.skippedItems.length - 3} weitere` : '';
        setWarningMessage(`Bereits in der Liste: ${skippedList}${moreText}`);
        setShowWarningToast(true);
        setTimeout(() => setShowWarningToast(false), 5000);
      }

      // Falls nichts hinzugefügt wurde
      if (result.added === 0 && result.skipped === 0) {
        showToast('Keine Zutaten gefunden', true);
      }
    } catch (error: any) {
      showToast(error.message || 'Fehler beim Hinzufügen zur Einkaufsliste', true);
    } finally {
      setAddingToList(false);
    }
  };

  const handleCardClick = () => {
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  // ⚡ Performance: Verwende Konstanten statt Funktionen
  const mealIcon = MEAL_ICONS[mealType];
  const mealColor = MEAL_COLORS[mealType];

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border-2 border-primary-500 dark:border-primary-600 transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${mealColor} text-white font-semibold text-sm`}>
            <span className="text-lg">{mealIcon}</span>
            <span>{mealTypeTranslation}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg transition shadow-md disabled:cursor-not-allowed flex items-center gap-1"
              title="Speichern"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="p-2 bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-700 text-white rounded-lg transition shadow-md"
              title="Abbrechen"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Mahlzeit Name *
            </label>
            <input
              type="text"
              placeholder="z.B. Spaghetti Bolognese"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Beschreibung (optional)
            </label>
            <textarea
              placeholder="z.B. Mit frischem Parmesan"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Zutaten (optional)
            </label>
            <textarea
              placeholder="z.B. 200g Spaghetti, 400g Hackfleisch, 1 Zwiebel"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition"
              rows={3}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={handleCardClick}
        className="group bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-4 border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700"
      >
        <div className="flex items-center justify-between mb-3">
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full bg-gradient-to-r ${mealColor} text-white font-semibold text-xs`}>
            <span className="text-base">{mealIcon}</span>
            <span>{mealType}</span>
          </div>
          {meal && (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition opacity-0 group-hover:opacity-100"
              title="Löschen"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {meal ? (
          <div className="space-y-2">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base line-clamp-2">
              {meal.meal_name}
            </h3>

            {meal.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {meal.description}
              </p>
            )}

            {meal.ingredients && (
              <div className="pt-2 space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-500 italic line-clamp-2">
                  Zutaten: {meal.ingredients}
                </p>
                <button
                  onClick={handleAddToShoppingList}
                  disabled={addingToList}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-lg transition shadow-md text-sm font-medium disabled:cursor-not-allowed"
                >
                  {addingToList ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Wird hinzugefügt...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={16} />
                      Zur Einkaufsliste
                    </>
                  )}
                </button>
              </div>
            )}

            {meal.created_by_name && (
              <p className="text-xs text-gray-400 dark:text-gray-600 pt-2">
                {meal.updated_by_name && meal.updated_by_name !== meal.created_by_name
                  ? `✏️ ${meal.updated_by_name}`
                  : `👤 ${meal.created_by_name}`}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-2 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition">
              <Plus size={24} className="text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition" />
            </div>
            <p className="text-gray-400 dark:text-gray-500 text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition font-medium">
              Klicke hier um eine Mahlzeit hinzuzufügen
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl animate-slideUp">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                Mahlzeit löschen?
              </h3>
            </div>

            <div className="mb-6">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                  {meal?.meal_name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {day} - {mealType}
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg transition font-medium flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Löschen
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 py-3 px-4 rounded-lg transition font-medium"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <Check size={20} />
            <span className="font-medium">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {showErrorToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <AlertCircle size={20} />
            <span className="font-medium">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Warning Toast */}
      {showWarningToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slideUp">
          <div className="bg-orange-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-md">
            <Info size={20} className="flex-shrink-0" />
            <span className="font-medium">{warningMessage}</span>
          </div>
        </div>
      )}
    </>
  );
};

// ⚡ Performance: Export mit React.memo - verhindert Re-Renders wenn Props gleich sind
export const MealCard = memo(MealCardComponent, (prevProps, nextProps) => {
  // Custom Vergleichsfunktion: Re-render nur wenn sich meal tatsächlich ändert
  return prevProps.meal?.id === nextProps.meal?.id &&
         prevProps.meal?.updated_at === nextProps.meal?.updated_at &&
         prevProps.day === nextProps.day &&
         prevProps.mealType === nextProps.mealType;
});
