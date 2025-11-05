import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Camera, Clock, Upload, AlertCircle, Loader2, Trash2, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import { Layout } from '../components/Layout';
import { shoppingAPI, ingredientsAPI } from '../api/shopping';
import { ShoppingListItem, Ingredient } from '../types';

// ============================================
// CLIENT-SIDE CACHE
// ============================================
const searchResultsCache = new Map<string, {
  results: Ingredient[];
  hasMore: boolean;
  total: number;
  totalPages: number;
  timestamp: number;
}>();

const CACHE_TTL = 1800000; // 30 Minuten
const pendingRequests = new Map<string, Promise<any>>();

export const ShoppingList = () => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [recentItems, setRecentItems] = useState<Ingredient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Ingredient[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [apiLimited, setApiLimited] = useState(false);
  const [maxPages, setMaxPages] = useState(20);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchStartTime, setSearchStartTime] = useState<number>(0);
  
  // ✅ NEU: Long-Press State
  const [longPressItem, setLongPressItem] = useState<Ingredient | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);

  const searchTimeoutRef = useRef<number>();
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadData();
    loadRecentItems();
  }, []);

  useEffect(() => {
    return () => {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearchPage(1);
      setTotalPages(0);
      setTotalResults(0);
      setSearchError('');
      setApiLimited(false);
      
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      return;
    }
    
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      await performSearch(1);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const performSearch = async (page: number) => {
    const cacheKey = `${searchQuery.toLowerCase()}:${page}`;
    
    const cached = searchResultsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`✅ Cache HIT: ${cacheKey}`);
      setSearchResults(cached.results);
      setSearchPage(page);
      setTotalResults(cached.total);
      setTotalPages(cached.totalPages);
      setSearchError('');
      setSearching(false);
      
      if (cached.hasMore && page < 3) {
        prefetchNextPage(searchQuery, page + 1);
      }
      
      return;
    }

    if (pendingRequests.has(cacheKey)) {
      console.log(`⏳ Waiting for pending request: ${cacheKey}`);
      try {
        const data = await pendingRequests.get(cacheKey);
        updateSearchResults(data, page, cacheKey);
      } catch (err) {
        console.error('Pending request error:', err);
        setSearchError('Suche fehlgeschlagen. Bitte erneut versuchen.');
        setSearching(false);
      }
      return;
    }

    setSearching(true);
    setSearchError('');
    setSearchStartTime(Date.now());
    
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    searchAbortControllerRef.current = new AbortController();
    
    try {
      const searchPromise = ingredientsAPI.search(searchQuery, page);
      pendingRequests.set(cacheKey, searchPromise);
      
      const data = await searchPromise;
      
      const searchDuration = ((Date.now() - searchStartTime) / 1000).toFixed(1);
      console.log(`⏱️ Search completed in ${searchDuration}s`);
      
      updateSearchResults(data, page, cacheKey);
      
      // ✅ Prüfe API-Limit
      if (data.apiLimited) {
        setApiLimited(true);
        setMaxPages(data.maxPages || 20);
      }
      
      if (data.hasMore && page < 3) {
        prefetchNextPage(searchQuery, page + 1);
      }
      
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Search error:', err);
        setSearchError(err.message || 'Suche fehlgeschlagen. Bitte erneut versuchen.');
        setSearchResults([]);
        setTotalPages(0);
        setTotalResults(0);
      }
    } finally {
      pendingRequests.delete(cacheKey);
      setSearching(false);
    }
  };

  const updateSearchResults = (data: any, page: number, cacheKey: string) => {
    const results = data.results || [];
    const total = data.total || 0;
    const pages = data.totalPages || 0;
    
    setSearchResults(results);
    setSearchPage(page);
    setTotalResults(total);
    setTotalPages(pages);
    setSearchError('');
    
    if (data.apiLimited) {
      setApiLimited(true);
      setMaxPages(data.maxPages || 20);
    }
    
    searchResultsCache.set(cacheKey, {
      results: results,
      hasMore: data.hasMore || false,
      total: total,
      totalPages: pages,
      timestamp: Date.now()
    });
    
    console.log(`📊 Results: Page ${page}/${pages}, Total: ${total}, Items: ${results.length}`);
  };

  const prefetchNextPage = async (query: string, page: number) => {
    const cacheKey = `${query.toLowerCase()}:${page}`;
    if (searchResultsCache.has(cacheKey)) return;
    
    console.log(`🔮 Prefetching page ${page}...`);
    try {
      const data = await ingredientsAPI.search(query, page);
      
      searchResultsCache.set(cacheKey, {
        results: data.results || [],
        hasMore: data.hasMore || false,
        total: data.total || 0,
        totalPages: data.totalPages || 0,
        timestamp: Date.now()
      });
      
      console.log(`✅ Prefetched page ${page}`);
    } catch (err) {
      console.error('Prefetch error:', err);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages && !searching) {
      performSearch(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await shoppingAPI.getCurrentList();
      setItems(data.items || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentItems = async () => {
    try {
      const data = await ingredientsAPI.getFrequent();
      setRecentItems(data);
    } catch (err) {
      console.error('Error loading recent items:', err);
    }
  };

  const filteredRecentItems = useMemo(() => {
    const activeItemNames = new Set(
      items
        .filter(item => !item.is_checked)
        .map(item => item.name.toLowerCase().trim())
    );

    return recentItems.filter(
      recentItem => !activeItemNames.has(recentItem.name.toLowerCase().trim())
    );
  }, [items, recentItems]);

  const handleAddItem = async (name: string, ingredientId?: number, imageUrl?: string) => {
    try {
      const added = await shoppingAPI.addItem({
        name,
        ingredient_id: ingredientId,
        image_url: imageUrl
      });
      
      setItems(prev => [added, ...prev]);
      setSearchQuery('');
      setSearchResults([]);
      
      loadRecentItems();
      
      setSuccess(`${name} hinzugefügt`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      // ✅ Bessere Duplikat-Behandlung
      if (err.message.includes('bereits') || err.message.includes('vorhanden')) {
        setError(`"${name}" ist bereits in der Liste`);
      } else {
        setError(err.message || 'Fehler beim Hinzufügen');
      }
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleToggleItem = async (id: number) => {
    try {
      await shoppingAPI.toggleItem(id);
      
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, is_checked: true } : item
      ));
      
      setTimeout(() => {
        setItems(prev => prev.filter(item => item.id !== id));
        loadRecentItems();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Aktualisieren');
    }
  };

  // ============================================
  // ✅ NEU: LONG-PRESS FUNKTIONALITÄT
  // ============================================
  const handleLongPressStart = (item: Ingredient) => {
    longPressTimerRef.current = window.setTimeout(() => {
      setLongPressItem(item);
      setShowDeleteModal(true);
      
      // Vibriere bei Mobile (falls unterstützt)
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 800); // 800ms für Long-Press
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleDeleteIngredient = async () => {
    if (!longPressItem?.id) return;

    try {
      await ingredientsAPI.deleteIngredient(longPressItem.id);
      
      // Entferne aus Recent Items
      setRecentItems(prev => prev.filter(item => item.id !== longPressItem.id));
      
      // Entferne aus Suchergebnissen
      setSearchResults(prev => prev.filter(item => item.id !== longPressItem.id));
      
      setSuccess('Produkt gelöscht');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      if (err.message.includes('verwendet')) {
        setError('Produkt kann nicht gelöscht werden - noch in Einkaufslisten vorhanden');
      } else {
        setError(err.message || 'Fehler beim Löschen');
      }
      setTimeout(() => setError(''), 3000);
    } finally {
      setShowDeleteModal(false);
      setLongPressItem(null);
    }
  };

  const groupedItems = items
    .filter(item => !item.is_checked)
    .reduce((acc, item) => {
      const categoryName = item.category_name || 'Sonstiges';
      if (!acc[categoryName]) {
        acc[categoryName] = {
          items: [],
          icon: item.category_icon || '📦',
          color: item.category_color || '#9CA3AF',
          sort: item.sort_order || 999
        };
      }
      acc[categoryName].items.push(item);
      return acc;
    }, {} as Record<string, { items: ShoppingListItem[]; icon: string; color: string; sort: number }>);

  const sortedCategories = Object.entries(groupedItems).sort((a, b) => a[1].sort - b[1].sort);

  const Pagination = () => {
    if (totalPages <= 1) return null;
    
    const maxVisiblePages = 7;
    const pages: (number | string)[] = [];
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (searchPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (searchPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = searchPage - 1; i <= searchPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return (
      <div className="space-y-3">
        {/* ✅ API Limit Warning */}
        {apiLimited && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-yellow-800 dark:text-yellow-200">
                <p className="font-medium mb-1">OpenFoodFacts API Limit erreicht</p>
                <p>Die API zeigt maximal {maxPages} Seiten (ca. {maxPages * 20} Produkte). Bei {totalResults.toLocaleString()} Produkten in der Datenbank können nicht alle angezeigt werden. Verfeinere deine Suche für bessere Ergebnisse.</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => goToPage(searchPage - 1)}
            disabled={searchPage === 1 || searching}
            className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition"
            title="Vorherige Seite"
          >
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </button>

          {pages.map((page, index) => (
            typeof page === 'number' ? (
              <button
                key={index}
                onClick={() => goToPage(page)}
                disabled={searching}
                className={`min-w-[40px] h-10 px-3 rounded-lg font-medium transition ${
                  searchPage === page
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {page}
              </button>
            ) : (
              <span key={index} className="px-2 text-gray-500 dark:text-gray-400">
                {page}
              </span>
            )
          ))}

          <button
            onClick={() => goToPage(searchPage + 1)}
            disabled={searchPage === totalPages || searching}
            className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition"
            title="Nächste Seite"
          >
            <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Layout title="Einkaufsliste">
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 dark:border-primary-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Lade Einkaufsliste...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Einkaufsliste">

      {/* Search & Actions Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700 sticky top-16 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {items.filter(i => !i.is_checked).length} offene Artikel
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition flex items-center gap-2"
              title="Eigenes Produkt hinzufügen"
            >
              <Camera size={20} />
              <span className="hidden sm:inline">Produkt hinzufügen</span>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Produkte suchen (z.B. Migros, Coop, Rivella)..."
              className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchError('');
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="container mx-auto px-4 pt-4">
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}
      
      {success && (
        <div className="container mx-auto px-4 pt-4">
          <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg flex items-center gap-2">
            <ShoppingCart size={20} />
            {success}
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-6">
        {searchQuery.length >= 2 && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Search className="text-gray-500" size={20} />
              <h3 className="font-bold text-gray-800 dark:text-gray-100">
                Suchergebnisse für "{searchQuery}"
              </h3>
              {!searching && totalResults > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  ({totalResults.toLocaleString()} Produkte)
                </span>
              )}
              {totalPages > 0 && (
                <span className="ml-auto text-sm font-medium text-primary-600 dark:text-primary-400">
                  Seite {searchPage} / {totalPages.toLocaleString()}
                </span>
              )}
            </div>

            {searchError && (
              <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <span className="text-sm text-yellow-800 dark:text-yellow-200">{searchError}</span>
              </div>
            )}

            {searching ? (
              <div className="text-center py-8">
                <Loader2 className="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                  {searchPage === 1 ? 'Suche in OpenFoodFacts Datenbank...' : `Lade Seite ${searchPage}...`}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Dies kann 20-30 Sekunden dauern ⏱️
                </p>
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {searchResults.map((item, index) => (
                    <button
                      key={item.code || item.id || `search-${index}`}
                      onClick={() => handleAddItem(item.name, item.id, item.image)}
                      onMouseDown={() => handleLongPressStart(item)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={() => handleLongPressStart(item)}
                      onTouchEnd={handleLongPressEnd}
                      className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition group"
                      title="Klicken zum Hinzufügen, Halten zum Löschen"
                    >
                      <div className="w-16 h-16 mb-2 rounded-lg flex items-center justify-center text-3xl bg-gray-50 dark:bg-gray-700 group-hover:scale-110 transition-transform overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{item.icon || item.categoryIcon || '📦'}</span>
                        )}
                      </div>
                      <span className="text-xs text-center text-gray-700 dark:text-gray-300 font-medium line-clamp-2">
                        {item.name}
                      </span>
                      {item.country && (
                        <span className="text-xs mt-1">{item.country}</span>
                      )}
                    </button>
                  ))}
                </div>
                
                <Pagination />
              </>
            ) : searchPage === 1 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Keine Produkte gefunden
                </p>
                <button
                  onClick={() => handleAddItem(searchQuery)}
                  className="inline-flex flex-col items-center p-4 rounded-lg bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition border-2 border-dashed border-primary-300 dark:border-primary-700"
                >
                  <div className="w-16 h-16 mb-2 rounded-lg flex items-center justify-center text-4xl">
                    ➕
                  </div>
                  <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">
                    "{searchQuery}" manuell hinzufügen
                  </span>
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  Keine weiteren Produkte
                </p>
              </div>
            )}
          </div>
        )}

        {sortedCategories.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center mb-6">
            <ShoppingCart className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Liste ist leer
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Suche nach Produkten oder wähle aus "Zuletzt hinzugefügt"
            </p>
          </div>
        ) : (
          <div className="space-y-6 mb-6">
            {sortedCategories.map(([categoryName, { items: categoryItems, icon, color }]) => (
              <div key={categoryName} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <div 
                  className="px-4 py-3 border-l-4"
                  style={{ borderColor: color }}
                >
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span className="text-2xl">{icon}</span>
                    <span>{categoryName}</span>
                    <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                      {categoryItems.length}
                    </span>
                  </h3>
                </div>
                
                <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {categoryItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleToggleItem(item.id)}
                      className={`flex flex-col items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition group ${
                        item.is_checked ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="w-16 h-16 mb-2 rounded-lg flex items-center justify-center text-3xl bg-gray-50 dark:bg-gray-700 group-hover:scale-110 transition-transform relative overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(item as any).product_icon || icon}</span>
                        )}
                        {item.is_checked && (
                          <div className="absolute inset-0 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-4xl">✓</span>
                          </div>
                        )}
                      </div>
                      <span className={`text-xs text-center font-medium line-clamp-2 ${
                        item.is_checked 
                          ? 'line-through text-gray-500' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredRecentItems.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="text-gray-500" size={20} />
              <h3 className="font-bold text-gray-800 dark:text-gray-100">
                Zuletzt hinzugefügt
              </h3>
              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                {filteredRecentItems.length} Produkte
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filteredRecentItems.map((item, index) => (
                <button
                  key={item.id || `recent-${index}`}
                  onClick={() => handleAddItem(item.name, item.id, item.image)}
                  onMouseDown={() => handleLongPressStart(item)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onTouchStart={() => handleLongPressStart(item)}
                  onTouchEnd={handleLongPressEnd}
                  className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition group"
                  title="Klicken zum Hinzufügen, Halten zum Löschen"
                >
                  <div className="w-16 h-16 mb-2 rounded-lg flex items-center justify-center text-3xl bg-gray-50 dark:bg-gray-700 group-hover:scale-110 transition-transform overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{item.icon || item.categoryIcon || '📦'}</span>
                    )}
                  </div>
                  <span className="text-xs text-center text-gray-700 dark:text-gray-300 font-medium line-clamp-2">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {showUploadModal && (
        <UploadProductModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={(name, imageUrl) => {
            handleAddItem(name, undefined, imageUrl);
            setShowUploadModal(false);
          }}
        />
      )}

      {/* ✅ NEU: DELETE CONFIRMATION MODAL */}
      {showDeleteModal && longPressItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                Produkt löschen?
              </h3>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl bg-white dark:bg-gray-600 overflow-hidden">
                  {longPressItem.image ? (
                    <img src={longPressItem.image} alt={longPressItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{longPressItem.icon || longPressItem.categoryIcon || '📦'}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 dark:text-gray-100">
                    {longPressItem.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {longPressItem.category || 'Sonstiges'}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                Dieses Produkt wird aus der Datenbank gelöscht. Dies ist nur möglich, wenn es nicht mehr in Einkaufslisten verwendet wird.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDeleteIngredient}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition font-medium flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Löschen
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setLongPressItem(null);
                }}
                className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-lg transition font-medium"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

interface UploadProductModalProps {
  onClose: () => void;
  onSuccess: (name: string, imageUrl?: string) => void;
}

const UploadProductModal: React.FC<UploadProductModalProps> = ({ onClose, onSuccess }) => {
  const [productName, setProductName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await ingredientsAPI.getCategories();
      setCategories(data);
      setLoadingCategories(false);
    } catch (err) {
      console.error('Error loading categories:', err);
      setLoadingCategories(false);
    }
  };

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setError('Bitte nur Bilddateien hochladen');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!productName.trim()) {
      setError('Bitte Produktname eingeben');
      return;
    }

    if (!selectedCategory) {
      setError('Bitte Kategorie auswählen');
      return;
    }

    setUploading(true);
    setError('');

    try {
      let imageUrl = undefined;

      const formData = new FormData();
      formData.append('name', productName);
      formData.append('category_id', selectedCategory.toString());

      if (selectedFile) {
        formData.append('image', selectedFile);
      }

      const response = await shoppingAPI.uploadProduct(formData);
      imageUrl = response.ingredient.image_url;

      onSuccess(productName, imageUrl);
    } catch (error: any) {
      if (error.message.includes('bereits') || error.message.includes('vorhanden')) {
        setError(`"${productName}" existiert bereits`);
      } else {
        setError(error.message || 'Fehler beim Hochladen');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Eigenes Produkt hinzufügen
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X size={24} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Produktname */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Produktname *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => {
                setProductName(e.target.value);
                setError('');
              }}
              placeholder="z.B. Migros Eier Bio"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Kategorie-Auswahl */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kategorie * <span className="text-xs text-gray-500">(wird dort angezeigt)</span>
            </label>
            {loadingCategories ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin text-gray-400" size={24} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setError('');
                    }}
                    className={`p-3 rounded-lg border-2 transition flex items-center gap-2 ${
                      selectedCategory === category.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <span className="text-2xl">{category.icon}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {category.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Upload Area mit Drag & Drop */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Produktbild (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />

            {!preview ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg p-6 transition cursor-pointer ${
                  isDragging
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                    <Upload size={32} className="text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Klicken oder Bild hierher ziehen
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      PNG, JPG, GIF bis zu 5MB
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-w-full max-h-48 object-contain rounded-lg"
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setPreview('');
                  }}
                  className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition"
                  title="Bild entfernen"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="absolute bottom-2 right-2 px-3 py-1 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Ändern
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={handleUpload}
              disabled={uploading || !productName.trim() || !selectedCategory}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg transition font-medium flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <Camera size={18} />
                  Hinzufügen
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={uploading}
              className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50 text-gray-800 dark:text-gray-100 py-3 px-4 rounded-lg transition font-medium"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};