import { useState, useRef } from 'react';
import { Plus, Trash2, Save, Upload, X } from 'lucide-react';
import { recipeApi } from '../api/recipes';
import { useToast } from '../context/ToastContext';

interface ManualRecipeFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface Ingredient {
  ingredient_id: number;
  ingredient_name: string;
  amount: number;
  unit: string;
  notes: string;
}

interface Step {
  instruction: string;
}

export function ManualRecipeForm({ onSuccess, onCancel }: ManualRecipeFormProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    { ingredient_id: 0, ingredient_name: '', amount: 1, unit: '', notes: '' }
  ]);
  const [steps, setSteps] = useState<Step[]>([
    { instruction: '' }
  ]);

  const addIngredient = () => {
    setIngredients([...ingredients, { ingredient_id: 0, ingredient_name: '', amount: 1, unit: '', notes: '' }]);
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

    // Validierung
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

      // Preview erstellen
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
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

  const handleSubmit = async () => {
    // Validierung
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

      // Backend erstellt Zutaten automatisch aus Namen
      const processedIngredients = ingredients.map((ing) => ({
        ingredient_name: ing.ingredient_name.trim(),
        amount: ing.amount,
        unit: ing.unit.trim(),
        notes: ing.notes.trim()
      }));

      const recipeData = {
        ...formData,
        ingredients: processedIngredients,
        steps: steps.map((step, index) => ({
          step_number: index + 1,
          instruction: step.instruction
        }))
      };

      await recipeApi.create(recipeData);
      showToast('Rezept erfolgreich erstellt!', 'success');
      onSuccess();
    } catch (error: any) {
      console.error('Create recipe error:', error);
      showToast(error.message || 'Fehler beim Erstellen des Rezepts', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Basis-Informationen */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basis-Informationen</h3>

        {/* Bild Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Rezeptbild (optional)
          </label>

          {imagePreview ? (
            <div className="relative w-full h-48 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <img
                src={imagePreview}
                alt="Rezeptvorschau"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="recipe-image"
              />
              <label
                htmlFor="recipe-image"
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors bg-gray-50 dark:bg-gray-700/50"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600 mb-3"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Lädt hoch...</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Klicke hier um ein Bild hochzuladen
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      PNG, JPG, WebP (max. 5MB)
                    </p>
                  </>
                )}
              </label>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Rezeptname *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="z.B. Spaghetti Carbonara"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Beschreibung
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Kurze Beschreibung des Rezepts..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Portionen
            </label>
            <input
              type="number"
              value={formData.servings}
              onChange={(e) => setFormData({ ...formData, servings: parseInt(e.target.value) || 1 })}
              min="1"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vorbereitung (Min)
            </label>
            <input
              type="number"
              value={formData.prep_time}
              onChange={(e) => setFormData({ ...formData, prep_time: parseInt(e.target.value) || 0 })}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kochen (Min)
            </label>
            <input
              type="number"
              value={formData.cook_time}
              onChange={(e) => setFormData({ ...formData, cook_time: parseInt(e.target.value) || 0 })}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Schwierigkeit
          </label>
          <select
            value={formData.difficulty}
            onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option value="easy">Einfach</option>
            <option value="medium">Mittel</option>
            <option value="hard">Schwer</option>
          </select>
        </div>
      </div>

      {/* Zutaten */}
      <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Zutaten</h3>
          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Zutat hinzufügen
          </button>
        </div>

        {ingredients.map((ing, index) => (
          <div key={index} className="flex gap-2 items-start">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={ing.ingredient_name}
                onChange={(e) => updateIngredient(index, 'ingredient_name', e.target.value)}
                placeholder="Zutat"
                className="sm:col-span-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="number"
                value={ing.amount}
                onChange={(e) => updateIngredient(index, 'amount', parseFloat(e.target.value) || 0)}
                placeholder="Menge"
                step="0.1"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="text"
                value={ing.unit}
                onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                placeholder="Einheit"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => removeIngredient(index)}
              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Zubereitungsschritte */}
      <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Zubereitungsschritte</h3>
          <button
            type="button"
            onClick={addStep}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Schritt hinzufügen
          </button>
        </div>

        {steps.map((step, index) => (
          <div key={index} className="flex gap-2 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-sm mt-1">
              {index + 1}
            </div>
            <textarea
              value={step.instruction}
              onChange={(e) => updateStep(index, e.target.value)}
              placeholder={`Schritt ${index + 1}: Beschreibe was zu tun ist...`}
              rows={2}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => removeStep(index)}
              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              Speichert...
            </>
          ) : (
            <>
              <Save size={20} />
              Rezept erstellen
            </>
          )}
        </button>
      </div>
    </div>
  );
}
