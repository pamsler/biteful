import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Save, Upload, X, Bot, Code, AlertTriangle } from 'lucide-react';
import { ParsePDFResponse } from '../api/pdf-recipes';
import { recipeApi } from '../api/recipes';
import { useToast } from '../context/ToastContext';

interface RecipePreviewModalProps {
  isOpen: boolean;
  parsedData?: ParsePDFResponse | null;
  recipeId?: number;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSuccess: () => void;
}

interface Ingredient {
  ingredient_name: string;
  amount: number;
  amount_min?: number;
  amount_max?: number;
  unit: string;
  notes: string;
}

interface Step {
  instruction: string;
}

export function RecipePreviewModal({ isOpen, parsedData, recipeId, mode, onClose, onSuccess }: RecipePreviewModalProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    servings: 4,
    prep_time: 15,
    cook_time: 30,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    image_path: '',
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { ingredient_name: '', amount: 1, unit: '', notes: '' }
  ]);

  const [steps, setSteps] = useState<Step[]>([
    { instruction: '' }
  ]);

  // Load recipe in edit mode
  useEffect(() => {
    if (mode === 'edit' && recipeId && isOpen) {
      const loadRecipe = async () => {
        try {
          setLoading(true);
          const recipe = await recipeApi.getById(recipeId);

          setFormData({
            name: recipe.name || '',
            description: recipe.description || '',
            servings: recipe.servings || 4,
            prep_time: recipe.prep_time || 15,
            cook_time: recipe.cook_time || 30,
            difficulty: (recipe.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
            image_path: recipe.image_path || '',
          });

          // Setze Bildvorschau
          if (recipe.image_path) {
            const API_URL = (import.meta as any).env?.VITE_API_URL || '';
            setImagePreview(API_URL + recipe.image_path);
          } else {
            setImagePreview(null);
          }

          if (recipe.ingredients && recipe.ingredients.length > 0) {
            setIngredients(
              recipe.ingredients.map((ing: any) => ({
                ingredient_name: ing.ingredient_name || '',
                amount: ing.amount || 1,
                unit: ing.unit || '',
                notes: ing.notes || ''
              }))
            );
          } else {
            setIngredients([{ ingredient_name: '', amount: 1, unit: '', notes: '' }]);
          }

          if (recipe.steps && recipe.steps.length > 0) {
            setSteps(
              recipe.steps.map(step => ({ instruction: step.instruction || '' }))
            );
          } else {
            setSteps([{ instruction: '' }]);
          }
        } catch (error) {
          console.error('Error loading recipe:', error);
          showToast('Fehler beim Laden des Rezepts', 'error');
          onClose();
        } finally {
          setLoading(false);
        }
      };

      loadRecipe();
    }
  }, [mode, recipeId, isOpen]);

  // Update state when parsedData changes (create mode)
  useEffect(() => {
    if (mode === 'create' && parsedData?.recipe) {
      const recipe = parsedData.recipe;

      setFormData({
        name: recipe.name || '',
        description: recipe.description || '',
        servings: recipe.servings || 4,
        prep_time: recipe.prep_time || 15,
        cook_time: recipe.cook_time || 30,
        difficulty: (recipe.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
        image_path: recipe.image_path || '',
      });

      // Setze Bildvorschau wenn Bild aus PDF extrahiert wurde
      if (recipe.image_path) {
        const API_URL = (import.meta as any).env?.VITE_API_URL || '';
        setImagePreview(API_URL + recipe.image_path);
      } else {
        setImagePreview(null);
      }

      if (recipe.ingredients && recipe.ingredients.length > 0) {
        setIngredients(
          recipe.ingredients.map((ing: any) => ({
            ingredient_name: ing.ingredient_name || '',
            amount: ing.amount || 1,
            amount_min: ing.amount_min,
            amount_max: ing.amount_max,
            unit: ing.unit || '',
            notes: ing.notes || ''
          }))
        );
      } else {
        setIngredients([{ ingredient_name: '', amount: 1, unit: '', notes: '' }]);
      }

      if (recipe.steps && recipe.steps.length > 0) {
        setSteps(
          recipe.steps.map(step => ({ instruction: step.instruction || '' }))
        );
      } else {
        setSteps([{ instruction: '' }]);
      }
    }
  }, [mode, parsedData]);

  if (!isOpen) return null;

  const addIngredient = () => {
    setIngredients([...ingredients, { ingredient_name: '', amount: 1, unit: '', notes: '' }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const addStep = () => {
    setSteps([...steps, { instruction: '' }]);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  const updateStep = (index: number, instruction: string) => {
    const updated = [...steps];
    updated[index] = { instruction };
    setSteps(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Bitte wähle ein Bild aus', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Bild darf maximal 5MB groß sein', 'error');
      return;
    }

    try {
      setUploading(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      const result = await recipeApi.uploadImage(file);
      setFormData({ ...formData, image_path: result.imagePath });
      showToast('Bild erfolgreich hochgeladen!', 'success');
    } catch (error) {
      console.error('Image upload error:', error);
      showToast('Fehler beim Hochladen des Bildes', 'error');
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setFormData({ ...formData, image_path: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast('Bitte gib einen Rezeptnamen ein', 'error');
      return;
    }

    if (ingredients.some(ing => !ing.ingredient_name.trim())) {
      showToast('Bitte fülle alle Zutaten aus oder entferne leere Zeilen', 'error');
      return;
    }

    if (steps.some(step => !step.instruction.trim())) {
      showToast('Bitte fülle alle Schritte aus oder entferne leere Zeilen', 'error');
      return;
    }

    try {
      setSaving(true);

      const processedIngredients = ingredients.map((ing) => ({
        ingredient_name: ing.ingredient_name.trim(),
        amount: ing.amount,
        unit: ing.unit.trim(),
        notes: ing.notes.trim()
      }));

      const processedSteps = steps.map((step, index) => ({
        step_number: index + 1,
        instruction: step.instruction.trim()
      }));

      const recipeData = {
        ...formData,
        ingredients: processedIngredients,
        steps: processedSteps
      };

      if (mode === 'edit' && recipeId) {
        await recipeApi.update(recipeId, recipeData);
        showToast('Rezept erfolgreich aktualisiert!', 'success');
      } else {
        await recipeApi.create(recipeData);
        showToast('Rezept erfolgreich erstellt!', 'success');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Recipe save error:', error);
      const errorMessage = error.response?.data?.details || error.response?.data?.error || 'Fehler beim Speichern';
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const getMethodBadge = () => {
    if (mode === 'edit') return null; // Kein Badge im Edit-Modus

    if (!parsedData) return null;

    const method = parsedData.method;
    if (method.startsWith('ai-')) {
      const provider = method.replace('ai-', '');
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
          <Bot className="w-4 h-4" />
          <span>AI Parsing ({provider})</span>
        </div>
      );
    } else if (method === 'regex-fallback') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Regex (AI Fallback)</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
          <Code className="w-4 h-4" />
          <span>Regex Parsing</span>
        </div>
      );
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Loading State */}
          {loading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center z-20 rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600 dark:text-gray-400">Lade Rezept...</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {mode === 'edit' ? 'Rezept bearbeiten' : 'Rezept überprüfen & speichern'}
                </h3>
                <div className="flex items-center gap-3">
                  {getMethodBadge()}
                  {mode === 'create' && parsedData && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {parsedData.stats.ingredients} Zutaten • {parsedData.stats.steps} Schritte
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition ml-4"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Rezeptname *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="z.B. Spaghetti Carbonara"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Beschreibung
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="Kurze Beschreibung..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Portionen *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.servings}
                  onChange={(e) => setFormData({ ...formData, servings: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Schwierigkeit *
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="easy">Einfach</option>
                  <option value="medium">Mittel</option>
                  <option value="hard">Schwer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Vorbereitungszeit (Min)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.prep_time}
                  onChange={(e) => setFormData({ ...formData, prep_time: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Kochzeit (Min)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.cook_time}
                  onChange={(e) => setFormData({ ...formData, cook_time: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Rezeptbild (optional)
              </label>
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Bild hochladen (max. 5MB)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Zutaten * ({ingredients.length})
                </label>
                <button
                  onClick={addIngredient}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Hinzufügen
                </button>
              </div>
              <div className="space-y-2">
                {ingredients.map((ing, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    {/* Zeige zwei Felder wenn Range vorhanden */}
                    {ing.amount_min !== undefined && ing.amount_max !== undefined ? (
                      <>
                        <input
                          type="number"
                          step="0.1"
                          value={ing.amount_min}
                          onChange={(e) => {
                            updateIngredient(index, 'amount_min', parseFloat(e.target.value) || 0);
                            updateIngredient(index, 'amount', parseFloat(e.target.value) || 0);
                          }}
                          className="w-20 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                          placeholder="Min"
                        />
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                        <input
                          type="number"
                          step="0.1"
                          value={ing.amount_max}
                          onChange={(e) => updateIngredient(index, 'amount_max', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                          placeholder="Max"
                        />
                      </>
                    ) : (
                      /* Einzelnes Feld wenn keine Range */
                      <input
                        type="number"
                        step="0.1"
                        value={ing.amount}
                        onChange={(e) => updateIngredient(index, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                        placeholder="Menge"
                      />
                    )}
                    <input
                      type="text"
                      value={ing.unit}
                      onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                      className="w-20 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      placeholder="Einheit"
                    />
                    <input
                      type="text"
                      value={ing.ingredient_name}
                      onChange={(e) => updateIngredient(index, 'ingredient_name', e.target.value)}
                      className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      placeholder="Zutat"
                    />
                    <button
                      onClick={() => removeIngredient(index)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                      disabled={ingredients.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Zubereitungsschritte * ({steps.length})
                </label>
                <button
                  onClick={addStep}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Hinzufügen
                </button>
              </div>
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </span>
                    <textarea
                      value={step.instruction}
                      onChange={(e) => updateStep(index, e.target.value)}
                      rows={2}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      placeholder={`Schritt ${index + 1} beschreiben...`}
                    />
                    <button
                      onClick={() => removeStep(index)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition h-fit"
                      disabled={steps.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Speichere...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {mode === 'edit' ? 'Änderungen speichern' : 'Rezept speichern'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
