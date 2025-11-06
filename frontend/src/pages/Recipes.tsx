import { useState, useEffect } from 'react';
import { Plus, Search, Clock, Users, Trash2, Edit, BookOpen, ChefHat, FileText } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { recipeApi, Recipe } from '../api/recipes';
import { ManualRecipeForm } from '../components/ManualRecipeForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PdfUploadModal } from '../components/PdfUploadModal';
import { RecipePreviewModal } from '../components/RecipePreviewModal';
import { ParsePDFResponse } from '../api/pdf-recipes';
import { useTranslation } from 'react-i18next';

export function Recipes() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<{ id: number; name: string } | null>(null);
  const [showPdfUpload, setShowPdfUpload] = useState(false);
  const [showRecipePreview, setShowRecipePreview] = useState(false);
  const [parsedRecipeData, setParsedRecipeData] = useState<ParsePDFResponse | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRecipeId, setEditRecipeId] = useState<number | null>(null);

  useEffect(() => {
    loadRecipes();
  }, [selectedDifficulty]);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const data = await recipeApi.getAll({
        search: searchTerm,
        difficulty: selectedDifficulty || undefined
      });
      setRecipes(data);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadRecipes();
  };

  const openDeleteConfirm = (recipe: Recipe) => {
    setRecipeToDelete({ id: recipe.id, name: recipe.name });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!recipeToDelete) return;

    try {
      await recipeApi.delete(recipeToDelete.id);
      setRecipes(recipes.filter(r => r.id !== recipeToDelete.id));
      showToast(t('recipes.deleteSuccess'), 'success');
    } catch (error) {
      console.error('Error deleting recipe:', error);
      showToast(t('recipes.deleteError'), 'error');
    } finally {
      setRecipeToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const viewRecipe = async (id: number) => {
    try {
      const recipe = await recipeApi.getById(id);
      setSelectedRecipe(recipe);
      setShowDetail(true);
    } catch (error) {
      console.error('Error loading recipe:', error);
    }
  };

  const handlePdfUploadSuccess = (parsedData: ParsePDFResponse) => {
    setParsedRecipeData(parsedData);
    setShowPdfUpload(false);
    setShowRecipePreview(true);
    showToast(`PDF erfolgreich geparst (${parsedData.method})`, 'success');
  };

  const handleRecipePreviewSuccess = () => {
    loadRecipes();
    setShowRecipePreview(false);
    setParsedRecipeData(null);
  };

  const openEditModal = (recipeId: number) => {
    setEditRecipeId(recipeId);
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    loadRecipes();
    setShowEditModal(false);
    setEditRecipeId(null);
  };

  const difficultyColors = {
    easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  };

  const difficultyLabels = {
    easy: 'Einfach',
    medium: 'Mittel',
    hard: 'Schwer'
  };

  if (showDetail && selectedRecipe) {
    return (
      <Layout title="Rezept Details" showBackButton={false}>
        <div className="p-4 md:p-8">
          <div>
            <button
              onClick={() => setShowDetail(false)}
              className="mb-4 px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-600"
            >
              ← Zurück
            </button>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden">
            {selectedRecipe.image_path && (
              <img
                src={selectedRecipe.image_path}
                alt={selectedRecipe.name}
                className="w-full h-64 object-cover"
              />
            )}

            <div className="p-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {selectedRecipe.name}
              </h1>

              <div className="flex flex-wrap gap-4 mb-6 text-gray-700 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <span>{selectedRecipe.servings} Portionen</span>
                </div>
                {selectedRecipe.prep_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <span>{selectedRecipe.prep_time} Min Vorbereitung</span>
                  </div>
                )}
                {selectedRecipe.cook_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <span>{selectedRecipe.cook_time} Min Kochen</span>
                  </div>
                )}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${difficultyColors[selectedRecipe.difficulty as keyof typeof difficultyColors]}`}>
                  {difficultyLabels[selectedRecipe.difficulty as keyof typeof difficultyLabels]}
                </span>
              </div>

              {selectedRecipe.description && (
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {selectedRecipe.description}
                </p>
              )}

              {/* Ingredients */}
              {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Zutaten
                  </h2>
                  <ul className="space-y-2">
                    {selectedRecipe.ingredients.map((ing, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        {ing.icon && <span className="text-2xl">{ing.icon}</span>}
                        <span>
                          {ing.amount} {ing.unit} {ing.ingredient_name}
                        </span>
                        {ing.notes && <span className="text-sm text-gray-500">({ing.notes})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Steps */}
              {selectedRecipe.steps && selectedRecipe.steps.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Zubereitung
                  </h2>
                  <ol className="space-y-4">
                    {selectedRecipe.steps.map((step, idx) => (
                      <li key={idx} className="flex gap-4">
                        <span className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                          {step.step_number}
                        </span>
                        <p className="text-gray-700 dark:text-gray-300 pt-1">
                          {step.instruction}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </Layout>
    );
  }

  // Manual Recipe Form Modal
  if (showManualForm) {
    return (
      <Layout title="Neues Rezept erstellen">
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Eigenes Rezept erstellen
            </h2>
            <ManualRecipeForm
              onSuccess={() => {
                loadRecipes();
                setShowManualForm(false);
              }}
              onCancel={() => setShowManualForm(false)}
            />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Rezepte">
      {/* Search, Filter & Actions Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
            {/* Suchleiste */}
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rezepte durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 w-full lg:w-auto"
            >
              <option value="">Alle Schwierigkeiten</option>
              <option value="easy">Einfach</option>
              <option value="medium">Mittel</option>
              <option value="hard">Schwer</option>
            </select>

            {/* Filtern Button */}
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors w-full lg:w-auto"
            >
              Filtern
            </button>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <button
                className="flex-1 lg:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                onClick={() => setShowPdfUpload(true)}
                title="Rezept aus PDF importieren"
              >
                <FileText className="w-5 h-5" />
                <span className="hidden sm:inline">PDF Import</span>
              </button>
              <button
                className="flex-1 lg:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                onClick={() => setShowManualForm(true)}
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Neues Rezept</span>
                <span className="sm:hidden">Neu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recipe Grid */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Lade Rezepte...</p>
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Keine Rezepte gefunden
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
              Erstelle dein erstes Rezept!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer group"
                onClick={() => viewRecipe(recipe.id)}
              >
                {recipe.image_path ? (
                  <img
                    src={recipe.image_path}
                    alt={recipe.name}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                    <ChefHat className="w-16 h-16 text-primary-600 dark:text-gray-400" />
                  </div>
                )}

                <div className="p-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">
                    {recipe.name}
                  </h3>

                  {recipe.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {recipe.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{recipe.servings}</span>
                    </div>
                    {(recipe.prep_time || recipe.cook_time) && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{(recipe.prep_time || 0) + (recipe.cook_time || 0)} Min</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyColors[recipe.difficulty as keyof typeof difficultyColors]}`}>
                      {difficultyLabels[recipe.difficulty as keyof typeof difficultyLabels]}
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(recipe.id);
                        }}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Rezept bearbeiten"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirm(recipe);
                        }}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lösch-Bestätigung */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setRecipeToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Rezept löschen?"
        message={`Möchtest du das Rezept "${recipeToDelete?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmText="Ja, löschen"
        cancelText="Abbrechen"
        type="danger"
      />

      {/* PDF Upload Modal */}
      <PdfUploadModal
        isOpen={showPdfUpload}
        onClose={() => setShowPdfUpload(false)}
        onSuccess={handlePdfUploadSuccess}
      />

      {/* Recipe Preview Modal (Create from PDF) */}
      <RecipePreviewModal
        isOpen={showRecipePreview}
        mode="create"
        parsedData={parsedRecipeData}
        onClose={() => {
          setShowRecipePreview(false);
          setParsedRecipeData(null);
        }}
        onSuccess={handleRecipePreviewSuccess}
      />

      {/* Recipe Edit Modal */}
      {editRecipeId && (
        <RecipePreviewModal
          isOpen={showEditModal}
          mode="edit"
          recipeId={editRecipeId}
          onClose={() => {
            setShowEditModal(false);
            setEditRecipeId(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}
    </Layout>
  );
}
