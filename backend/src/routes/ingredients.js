const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { authMiddleware } = require('../middleware/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ⚡ Performance: HTTP Keep-Alive für wiederverwendbare Verbindungen
const axiosInstance = axios.create({
  httpAgent: new http.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
  }),
  httpsAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
  }),
  timeout: 35000,
});

console.log('⚡ Axios HTTP Keep-Alive aktiviert (Connection Pooling)');

// ============================================
// CONFIGURATION - VEREINFACHT & OPTIMIERT
// ============================================
const CONFIG = {
  CACHE_TTL: 3600000, // 1 Stunde
  MAX_CACHE_SIZE: 5000,
  API_TIMEOUT: 35000,
  PAGE_SIZE: 20,
  MAX_API_PAGES: 20, // ✅ OpenFoodFacts API Limit!
};

// ============================================
// IN-MEMORY CACHE
// ============================================
const searchCache = new Map();
const requestCache = new Map();

// Cache-Cleanup alle 10 Minuten
setInterval(() => {
  const now = Date.now();
  
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > CONFIG.CACHE_TTL) {
      searchCache.delete(key);
    }
  }
  
  if (searchCache.size > CONFIG.MAX_CACHE_SIZE) {
    const entries = Array.from(searchCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, entries.length - CONFIG.MAX_CACHE_SIZE).forEach(([key]) => {
      searchCache.delete(key);
    });
  }

  // Nur loggen wenn Cache nicht leer
  if (searchCache.size > 0) {
    console.log(`🧹 Cache cleaned: ${searchCache.size} entries`);
  }
}, 600000);

// ============================================
// HELPER: NORMALIZE NAME FÜR DUPLIKAT-CHECK
// ============================================
function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ============================================
// SEARCH ROUTE - VEREINFACHT
// ============================================
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { query, page = 1 } = req.query;
    const pageNum = parseInt(page);
    
    if (!query || query.length < 2) {
      return res.json({ 
        results: [], 
        hasMore: false, 
        page: 1, 
        total: 0, 
        totalPages: 0 
      });
    }

    console.log(`🔍 Search: "${query}" (Page ${pageNum})`);

    const cacheKey = `search:${query.toLowerCase()}:${pageNum}`;
    
    // 1. Cache-Check
    const cached = searchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CONFIG.CACHE_TTL)) {
      console.log(`✅ Cache HIT: ${cacheKey}`);
      return res.json(cached.data);
    }

    // 2. Request-Deduplizierung
    if (requestCache.has(cacheKey)) {
      console.log(`⏳ Waiting for existing request: ${cacheKey}`);
      try {
        const result = await requestCache.get(cacheKey);
        return res.json(result);
      } catch (err) {
        console.error('Request cache error:', err);
      }
    }

    // 3. Neue Suche durchführen
    const searchPromise = performSimplifiedSearch(query, pageNum);
    requestCache.set(cacheKey, searchPromise);
    
    try {
      const result = await searchPromise;
      
      // In Cache speichern
      searchCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return res.json(result);
    } finally {
      requestCache.delete(cacheKey);
    }
    
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({ 
      error: 'Fehler bei der Suche',
      message: error.message 
    });
  }
});

// ============================================
// VEREINFACHTE SUCH-LOGIK - MIT DUPLIKAT-CHECK
// ============================================
async function performSimplifiedSearch(query, pageNum) {
  const pageSize = CONFIG.PAGE_SIZE;

  let localResults = [];
  let apiProducts = [];
  let apiCount = 0;
  let apiPageCount = 0;
  let apiLimited = false;

  // ⚡ Performance: DB + API parallel abfragen (nur Seite 1)
  if (pageNum === 1) {
    console.log(`🌍 Parallel search: DB + API...`);

    try {
      const [localData, apiResponse] = await Promise.allSettled([
        // Lokale DB-Abfrage
        pool.query(
          `SELECT
            i.id,
            i.name,
            i.icon,
            i.image_url,
            i.usage_count,
            c.id as category_id,
            c.name as category_name,
            c.icon as category_icon,
            c.color as category_color
           FROM ingredients i
           LEFT JOIN ingredient_categories c ON i.category_id = c.id
           WHERE i.name ILIKE $1
           ORDER BY i.usage_count DESC, i.name ASC
           LIMIT 10`,
          [`%${query}%`]
        ),
        // OpenFoodFacts API-Abfrage
        searchOpenFoodFacts(query, pageNum)
      ]);

      // Lokale DB Ergebnisse verarbeiten
      if (localData.status === 'fulfilled') {
        localResults = localData.value.rows.map(row => ({
          id: row.id,
          name: row.name,
          icon: row.icon,
          category: row.category_name,
          categoryIcon: row.category_icon,
          categoryColor: row.category_color,
          categoryId: row.category_id,
          image: row.image_url,
          source: 'local',
          usageCount: row.usage_count,
          country: '🇨🇭'
        }));
        console.log(`📦 Local DB: ${localResults.length} results`);
      } else {
        console.error('Local DB error:', localData.reason);
      }

      // API Ergebnisse verarbeiten
      if (apiResponse.status === 'fulfilled') {
        apiProducts = apiResponse.value.products;
        apiCount = apiResponse.value.count;
        apiPageCount = apiResponse.value.pageCount;

        if (apiPageCount >= CONFIG.MAX_API_PAGES) {
          apiLimited = true;
          console.log(`⚠️ API Limit reached: ${CONFIG.MAX_API_PAGES} pages max`);
        }

        console.log(`✅ API Success: ${apiProducts.length} products, total: ${apiCount}`);
      } else {
        console.error(`❌ API Error:`, apiResponse.reason?.message);

        // Fallback auf lokale Ergebnisse wenn vorhanden
        if (localResults.length > 0) {
          console.log(`↩️ Using local results only due to API error`);
          return {
            results: localResults,
            hasMore: false,
            page: 1,
            total: localResults.length,
            totalPages: 1,
            cached: false,
            source: 'local-only'
          };
        }

        return {
          results: [],
          hasMore: false,
          page: pageNum,
          total: 0,
          totalPages: 0,
          cached: false,
          error: 'API nicht verfügbar'
        };
      }

    } catch (error) {
      console.error('Parallel search error:', error);
      return {
        results: [],
        hasMore: false,
        page: pageNum,
        total: 0,
        totalPages: 0,
        cached: false,
        error: 'Suche fehlgeschlagen'
      };
    }
  } else {
    // Seite 2+: Nur API-Abfrage
    console.log(`🌍 Searching OpenFoodFacts (page ${pageNum})...`);

    try {
      const apiResponse = await searchOpenFoodFacts(query, pageNum);
      apiProducts = apiResponse.products;
      apiCount = apiResponse.count;
      apiPageCount = apiResponse.pageCount;

      if (apiPageCount >= CONFIG.MAX_API_PAGES) {
        apiLimited = true;
        console.log(`⚠️ API Limit reached: ${CONFIG.MAX_API_PAGES} pages max`);
      }

      console.log(`✅ API Success: ${apiProducts.length} products, total: ${apiCount}`);
    } catch (error) {
      console.error(`❌ API Error:`, error.message);

      return {
        results: [],
        hasMore: false,
        page: pageNum,
        total: 0,
        totalPages: 0,
        cached: false,
        error: 'API nicht verfügbar'
      };
    }
  }

  // SCHRITT 3: Ergebnisse kombinieren (nur Seite 1)
  let allResults = apiProducts;
  
  if (pageNum === 1 && localResults.length > 0) {
    // Zeige lokale Ergebnisse ZUERST (bevorzugt), dann API ohne exakte Duplikate
    const existingNames = new Set(localResults.map(r => normalizeName(r.name)));
    const uniqueApiResults = apiProducts.filter(
      r => !existingNames.has(normalizeName(r.name))
    );
    allResults = [...localResults, ...uniqueApiResults];
    console.log(`📊 Combined: ${allResults.length} results (${localResults.length} local + ${uniqueApiResults.length} unique API)`);
  } else {
    console.log(`📊 API only: ${allResults.length} results`);
  }

  // SCHRITT 4: Pagination auf 20 Produkte
  const paginatedResults = allResults.slice(0, pageSize);

  // SCHRITT 5: Batch-Save neue API-Produkte (async, non-blocking)
  // ✅ Speichere NUR neue Produkte, die noch nicht in DB sind
  if (apiProducts.length > 0) {
    batchSaveProducts(apiProducts.slice(0, 50)).catch(err => 
      console.error('Background save error:', err)
    );
  }

  // SCHRITT 6: Response zusammenstellen
  const totalCount = apiCount || allResults.length;
  let totalPages;
  
  if (apiLimited) {
    totalPages = CONFIG.MAX_API_PAGES;
  } else {
    totalPages = Math.min(
      Math.ceil(totalCount / pageSize),
      CONFIG.MAX_API_PAGES
    );
  }
  
  const hasMore = pageNum < totalPages && paginatedResults.length === pageSize;

  const response = {
    results: paginatedResults,
    hasMore: hasMore,
    page: pageNum,
    total: totalCount,
    totalPages: totalPages,
    cached: false,
    apiLimited: apiLimited,
    maxPages: CONFIG.MAX_API_PAGES
  };

  console.log(`✅ Page ${pageNum}/${totalPages}: ${paginatedResults.length} results, Total: ${totalCount}${apiLimited ? ' (API Limited)' : ''}`);

  return response;
}

// ============================================
// EINFACHE OPENFOODFACTS SUCHE
// ============================================
async function searchOpenFoodFacts(query, page) {
  const params = {
    search_terms: query,
    action: 'process',
    json: 1,
    page: page,
    page_size: CONFIG.PAGE_SIZE,
    fields: 'code,product_name,product_name_de,brands,image_small_url,categories_tags,countries_tags',
    sort_by: 'unique_scans_n',
  };

  console.log(`🌐 API Call: page=${page}, query="${query}"`);

  // ⚡ Performance: Verwende axiosInstance mit Connection Pooling
  const response = await axiosInstance.get('https://world.openfoodfacts.org/cgi/search.pl', {
    params: params,
    headers: {
      'User-Agent': 'MealPlanner/4.0 (Swiss App)',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    validateStatus: (status) => status < 500,
  });

  if (response.status !== 200) {
    throw new Error(`API returned status ${response.status}`);
  }

  if (!response.data || !response.data.products) {
    throw new Error('Invalid API response format');
  }

  const count = response.data.count || 0;
  const pageCount = Math.min(response.data.page_count || 0, CONFIG.MAX_API_PAGES);
  const rawProducts = response.data.products || [];

  console.log(`📊 API Response: status=${response.status}, count=${count}, page_count=${pageCount}, products=${rawProducts.length}`);

  const processedProducts = rawProducts
    .filter(p => {
      const name = p.product_name_de || p.product_name;
      return name && name.trim().length > 0;
    })
    .map(product => {
      const name = product.product_name_de || product.product_name;
      const brands = product.brands || '';
      const brandName = brands ? `${name} (${brands.split(',')[0].trim()})` : name;

      const { categoryId, categoryIcon, productIcon } = detectCategoryAndIcon(product);
      const isSwiss = isSwissProduct(product);

      return {
        code: product.code,
        name: brandName.trim(),
        icon: productIcon,
        category: 'Sonstiges',
        categoryIcon: categoryIcon,
        categoryId: categoryId,
        image: product.image_small_url,
        source: 'api',
        country: isSwiss ? '🇨🇭' : '🌍',
        isSwiss: isSwiss
      };
    });

  return {
    products: processedProducts,
    count: count,
    page: page,
    pageCount: pageCount,
    pageSize: CONFIG.PAGE_SIZE
  };
}

// ============================================
// HELPER: SCHWEIZER PRODUKT ERKENNEN
// ============================================
function isSwissProduct(product) {
  const countriesTags = product.countries_tags || [];
  const brands = (product.brands || '').toLowerCase();
  const productName = (product.product_name || product.product_name_de || '').toLowerCase();

  const swissCountryTags = ['en:switzerland', 'ch', 'schweiz', 'suisse', 'svizzera'];
  if (countriesTags.some(tag => swissCountryTags.some(swiss => tag.toLowerCase().includes(swiss)))) {
    return true;
  }

  const swissBrands = [
    'migros', 'coop', 'denner', 'spar', 'aldi suisse', 'lidl schweiz', 'volg',
    'emmi', 'nestlé', 'nestle', 'lindt', 'toblerone', 'rivella', 'ovomaltine',
    'gruyère', 'gruyere', 'appenzeller', 'kambly', 'ragusa', 'cailler', 'frey',
    'm-budget', 'migros bio', 'betty bossi',
    'coop naturaplan', 'prix garantie', 'fine food',
    'zweifel', 'ricola', 'hero', 'thomy', 'aromat', 'knorr',
    'farmer', 'elmer', 'tilsiter', 'sbrinz'
  ];

  if (swissBrands.some(brand => brands.includes(brand) || productName.includes(brand))) {
    return true;
  }

  return false;
}

// ============================================
// BATCH-SPEICHERUNG MIT ON CONFLICT
// ============================================
async function batchSaveProducts(products) {
  if (!products || products.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let savedCount = 0;
    let updatedCount = 0;

    for (const product of products) {
      // ✅ ON CONFLICT: Aktualisiere nur Bild/Icon falls besser
      const result = await client.query(
        `INSERT INTO ingredients (name, icon, category_id, image_url, usage_count)
         VALUES ($1, $2, $3, $4, 0)
         ON CONFLICT (name) DO UPDATE 
         SET image_url = COALESCE(ingredients.image_url, EXCLUDED.image_url),
             icon = COALESCE(ingredients.icon, EXCLUDED.icon),
             updated_at = CURRENT_TIMESTAMP
         RETURNING (xmax = 0) AS inserted`,
        [product.name, product.icon, product.categoryId, product.image]
      );

      if (result.rows[0].inserted) {
        savedCount++;
      } else {
        updatedCount++;
      }
    }

    await client.query('COMMIT');
    
    if (savedCount > 0) {
      console.log(`💾 Batch saved ${savedCount} new products`);
    }
    if (updatedCount > 0) {
      console.log(`🔄 Updated ${updatedCount} existing products`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch save error:', error);
  } finally {
    client.release();
  }
}

// ============================================
// ICON-ERKENNUNG
// ============================================
const PRODUCT_ICON_MAP = {
  '🍎': ['apfel', 'apple', 'pomme'],
  '🍌': ['banane', 'banana'],
  '🍊': ['orange'],
  '🍋': ['zitrone', 'lemon', 'citron'],
  '🍇': ['traube', 'grape', 'raisin'],
  '🍓': ['erdbeere', 'strawberry', 'fraise'],
  '🍅': ['tomate', 'tomato'],
  '🥒': ['gurke', 'cucumber'],
  '🥕': ['karotte', 'möhre', 'carrot'],
  '🥔': ['kartoffel', 'potato'],
  '🧅': ['zwiebel', 'onion'],
  '🫑': ['paprika', 'pepper'],
  '🥬': ['salat', 'lettuce'],
  '🥛': ['milch', 'milk', 'lait'],
  '🧀': ['käse', 'cheese', 'fromage', 'gruyère', 'emmentaler'],
  '🧈': ['butter'],
  '🥚': ['ei', 'egg', 'oeuf'],
  '🍞': ['brot', 'bread', 'pain'],
  '🥖': ['baguette', 'brötchen'],
  '🥩': ['fleisch', 'beef', 'rind', 'steak'],
  '🍗': ['hähnchen', 'chicken', 'poulet'],
  '🐟': ['fisch', 'fish', 'lachs'],
  '☕': ['kaffee', 'coffee', 'café'],
  '🍵': ['tee', 'tea', 'thé'],
  '🥤': ['cola', 'soda', 'limo', 'rivella', 'energy', 'redbull', 'red bull', 'monster'],
  '🧃': ['saft', 'juice', 'jus'],
  '🍺': ['bier', 'beer', 'bière'],
  '💧': ['wasser', 'water', 'eau'],
  '🍫': ['schokolade', 'chocolate', 'chocolat', 'toblerone', 'lindt'],
  '🍪': ['keks', 'cookie', 'biscuit'],
  '🍦': ['eis', 'ice cream', 'glace'],
  '🍝': ['pasta', 'nudeln', 'spaghetti'],
  '🍚': ['reis', 'rice', 'riz'],
  '🍕': ['pizza'],
  '🥨': ['bretzel', 'brezel']
};

const CATEGORY_MAP = [
  { id: 1, icon: '🍎', keywords: ['fruit', 'vegetable', 'obst', 'gemüse', 'légume'] },
  { id: 2, icon: '🥛', keywords: ['dairy', 'milk', 'cheese', 'milch', 'käse', 'lait', 'fromage'] },
  { id: 3, icon: '🥖', keywords: ['bread', 'bakery', 'brot', 'pain'] },
  { id: 4, icon: '🥩', keywords: ['meat', 'fish', 'fleisch', 'fisch', 'viande'] },
  { id: 5, icon: '🥤', keywords: ['beverage', 'drink', 'getränk', 'boisson'] },
  { id: 6, icon: '🧂', keywords: ['condiment', 'sauce', 'spice', 'gewürz'] },
  { id: 7, icon: '🍫', keywords: ['sweet', 'chocolate', 'candy', 'süß', 'snack'] },
  { id: 8, icon: '🧊', keywords: ['frozen', 'ice', 'tiefkühl', 'surgelé'] },
  { id: 9, icon: '🧹', keywords: ['household', 'cleaning', 'haushalt'] }
];

function detectCategoryAndIcon(product) {
  const name = (product.product_name || product.product_name_de || '').toLowerCase();
  const categoriesTags = product.categories_tags || [];
  const tagsString = categoriesTags.join(' ').toLowerCase();
  const combined = `${name} ${tagsString}`;

  let productIcon = null;
  for (const [icon, keywords] of Object.entries(PRODUCT_ICON_MAP)) {
    if (keywords.some(keyword => combined.includes(keyword))) {
      productIcon = icon;
      break;
    }
  }

  const OPENFOODFACTS_CATEGORY_MAP = {
    1: [
      'en:fruits', 'en:vegetables', 'en:fresh-vegetables', 'en:fresh-fruits',
      'en:apples', 'en:bananas', 'en:tomatoes', 'en:potatoes', 
      'en:salads', 'en:carrots', 'en:cucumbers', 'en:peppers',
      'fr:fruits', 'fr:legumes', 'de:obst', 'de:gemüse'
    ],
    2: [
      'en:dairies', 'en:milk', 'en:cheeses', 'en:yogurts', 'en:yoghurts',
      'en:butters', 'en:creams', 'en:eggs', 'en:dairy-desserts',
      'fr:produits-laitiers', 'fr:laits', 'fr:fromages',
      'de:milchprodukte', 'de:käse', 'de:joghurt'
    ],
    3: [
      'en:breads', 'en:pastries', 'en:breakfast-cereals', 'en:biscuits',
      'en:cakes', 'en:cookies', 'en:crackers',
      'fr:pains', 'fr:patisseries', 'de:brot', 'de:backwaren'
    ],
    4: [
      'en:meats', 'en:fishes', 'en:seafood', 'en:poultry',
      'en:beef', 'en:pork', 'en:chicken', 'en:salmon',
      'en:cold-cuts', 'en:sausages',
      'fr:viandes', 'fr:poissons', 'de:fleisch', 'de:fisch'
    ],
    5: [
      'en:beverages', 'en:drinks', 'en:waters', 'en:juices',
      'en:sodas', 'en:soft-drinks', 'en:energy-drinks',
      'en:teas', 'en:coffees', 'en:alcoholic-beverages',
      'en:beers', 'en:wines', 'en:plant-based-beverages',
      'fr:boissons', 'de:getränke'
    ],
    6: [
      'en:condiments', 'en:sauces', 'en:spices', 'en:oils',
      'en:vinegars', 'en:dressings', 'en:spreads',
      'fr:condiments', 'fr:sauces', 'de:gewürze', 'de:soßen'
    ],
    7: [
      'en:sweets', 'en:chocolates', 'en:candies', 'en:snacks',
      'en:chocolate-products', 'en:confectioneries',
      'fr:bonbons', 'fr:chocolats', 'de:süßigkeiten', 'de:schokolade'
    ],
    8: [
      'en:frozen-foods', 'en:ice-creams', 'en:frozen-meals',
      'en:frozen-vegetables', 'en:frozen-pizzas',
      'fr:surgelés', 'de:tiefkühlkost'
    ],
    9: [
      'en:hygiene', 'en:household', 'en:cleaning-products',
      'en:beauty', 'en:personal-care'
    ]
  };

  for (const [categoryId, ofCategories] of Object.entries(OPENFOODFACTS_CATEGORY_MAP)) {
    for (const tag of categoriesTags) {
      const lowerTag = tag.toLowerCase();
      if (ofCategories.some(ofCat => lowerTag.includes(ofCat))) {
        return {
          categoryId: parseInt(categoryId),
          categoryIcon: CATEGORY_MAP[parseInt(categoryId) - 1].icon,
          productIcon: productIcon || CATEGORY_MAP[parseInt(categoryId) - 1].icon
        };
      }
    }
  }

  for (const match of CATEGORY_MAP) {
    if (match.keywords.some(keyword => combined.includes(keyword))) {
      return {
        categoryId: match.id,
        categoryIcon: match.icon,
        productIcon: productIcon || match.icon
      };
    }
  }

  return { categoryId: 10, categoryIcon: '📦', productIcon: productIcon || '📦' };
}

// ============================================
// WEITERE ROUTES
// ============================================
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ingredient_categories ORDER BY sort_order, name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

router.get('/frequent', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        i.id,
        i.name,
        i.icon,
        i.image_url as image,
        c.icon as "categoryIcon",
        c.color as "categoryColor",
        c.name as category,
        i.usage_count
       FROM ingredients i
       LEFT JOIN ingredient_categories c ON i.category_id = c.id
       WHERE i.usage_count > 0
       ORDER BY i.updated_at DESC, i.usage_count DESC
       LIMIT 30`
    );

    console.log(`📦 Recent items loaded: ${result.rows.length} items`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching frequent items:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// ✅ NEU: DELETE INGREDIENT
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Prüfe ob Produkt in Einkaufsliste verwendet wird
    const inUse = await pool.query(
      'SELECT COUNT(*) as count FROM shopping_list_items WHERE ingredient_id = $1',
      [id]
    );

    if (parseInt(inUse.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Produkt wird noch verwendet',
        message: 'Dieses Produkt ist noch in Einkaufslisten vorhanden'
      });
    }

    const result = await pool.query(
      'DELETE FROM ingredients WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }

    console.log(`🗑️ Deleted ingredient: ${result.rows[0].name}`);
    res.json({ success: true, message: 'Produkt gelöscht' });
  } catch (error) {
    console.error('Error deleting ingredient:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

module.exports = router;