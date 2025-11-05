const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../services/activity-logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// MULTER CONFIG
const uploadDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Bilder erlaubt'));
    }
  }
});

// ============================================
// HELPER: NORMALIZE NAME FÜR DUPLIKAT-CHECK
// ============================================
function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Get current shopping list MIT PRODUKT-ICON
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const { week, year } = req.query;
    const currentWeek = week || getCurrentWeekNumber();
    const currentYear = year || new Date().getFullYear();

    let list = await pool.query(
      'SELECT * FROM shopping_lists WHERE week_number = $1 AND year = $2',
      [currentWeek, currentYear]
    );

    if (list.rows.length === 0) {
      list = await pool.query(
        'INSERT INTO shopping_lists (week_number, year) VALUES ($1, $2) RETURNING *',
        [currentWeek, currentYear]
      );
    }

    const items = await pool.query(
      `SELECT 
        sli.id,
        sli.name,
        sli.is_checked,
        sli.created_at,
        c.id as category_id,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        c.sort_order,
        i.id as ingredient_id,
        i.icon as product_icon,
        i.image_url
       FROM shopping_list_items sli
       LEFT JOIN ingredient_categories c ON sli.category_id = c.id
       LEFT JOIN ingredients i ON sli.ingredient_id = i.id
       WHERE sli.shopping_list_id = $1
       ORDER BY sli.is_checked ASC, c.sort_order ASC, sli.created_at DESC`,
      [list.rows[0].id]
    );

    res.json({
      list: list.rows[0],
      items: items.rows
    });
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Einkaufsliste' });
  }
});

// Add item to shopping list MIT DUPLIKAT-SCHUTZ
router.post('/items', authMiddleware, async (req, res) => {
  try {
    const { name, ingredient_id, image_url, week, year } = req.body;
    const currentWeek = week || getCurrentWeekNumber();
    const currentYear = year || new Date().getFullYear();

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    const normalizedName = normalizeName(name);

    let list = await pool.query(
      'SELECT * FROM shopping_lists WHERE week_number = $1 AND year = $2',
      [currentWeek, currentYear]
    );

    if (list.rows.length === 0) {
      list = await pool.query(
        'INSERT INTO shopping_lists (week_number, year) VALUES ($1, $2) RETURNING *',
        [currentWeek, currentYear]
      );
    }

    // ✅ VERBESSERTER DUPLIKAT-CHECK in Shopping-Liste
    const existing = await pool.query(
      `SELECT * FROM shopping_list_items 
       WHERE shopping_list_id = $1 
       AND LOWER(TRIM(name)) = $2 
       AND is_checked = false`,
      [list.rows[0].id, normalizedName]
    );

    if (existing.rows.length > 0) {
      const itemWithIcon = await pool.query(
        `SELECT 
          sli.*,
          c.name as category_name,
          c.icon as category_icon,
          c.color as category_color,
          c.sort_order,
          i.id as ingredient_id,
          i.icon as product_icon,
          i.image_url
         FROM shopping_list_items sli
         LEFT JOIN ingredient_categories c ON sli.category_id = c.id
         LEFT JOIN ingredients i ON sli.ingredient_id = i.id
         WHERE sli.id = $1`,
        [existing.rows[0].id]
      );
      
      return res.status(409).json({ 
        ...itemWithIcon.rows[0], 
        error: 'Bereits vorhanden',
        message: `"${name}" ist bereits in der Einkaufsliste` 
      });
    }

    let ingredient;
    if (ingredient_id) {
      const ingredientResult = await pool.query(
        'SELECT * FROM ingredients WHERE id = $1',
        [ingredient_id]
      );
      ingredient = ingredientResult.rows[0];
      
      await pool.query(
        'UPDATE ingredients SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [ingredient_id]
      );
    } else {
      // ✅ VERBESSERTER DUPLIKAT-CHECK in Ingredients
      const existingIngredient = await pool.query(
        'SELECT * FROM ingredients WHERE LOWER(TRIM(name)) = $1',
        [normalizedName]
      );

      if (existingIngredient.rows.length > 0) {
        ingredient = existingIngredient.rows[0];
        await pool.query(
          'UPDATE ingredients SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [ingredient.id]
        );
      } else {
        const categoryId = await detectCategory(name.trim());
        const productIcon = detectProductIcon(name.trim());
        
        const newIngredient = await pool.query(
          `INSERT INTO ingredients (name, icon, category_id, image_url, usage_count)
           VALUES ($1, $2, $3, $4, 1)
           RETURNING *`,
          [name.trim(), productIcon, categoryId, image_url || null]
        );
        ingredient = newIngredient.rows[0];
        console.log(`✅ Created new ingredient: ${name.trim()}`);
      }
    }

    const result = await pool.query(
      `INSERT INTO shopping_list_items
       (shopping_list_id, ingredient_id, name, category_id, is_checked)
       VALUES ($1, $2, $3, $4, false)
       RETURNING *`,
      [list.rows[0].id, ingredient.id, name.trim(), ingredient.category_id]
    );

    const itemWithIcon = await pool.query(
      `SELECT
        sli.*,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        c.sort_order,
        i.id as ingredient_id,
        i.icon as product_icon,
        i.image_url
       FROM shopping_list_items sli
       LEFT JOIN ingredient_categories c ON sli.category_id = c.id
       LEFT JOIN ingredients i ON sli.ingredient_id = i.id
       WHERE sli.id = $1`,
      [result.rows[0].id]
    );

    // Activity Logging
    await logActivity({
      userId: req.user.id,
      username: req.user.displayName || req.user.username,
      actionType: 'SHOPPING_ADD',
      actionDescription: `hat "${name.trim()}" zur Einkaufsliste hinzugefügt`,
      entityType: 'shopping_item',
      entityId: result.rows[0].id,
      metadata: { itemName: name.trim(), week: currentWeek, year: currentYear }
    });

    res.json(itemWithIcon.rows[0]);
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen' });
  }
});

// Upload custom product MIT DUPLIKAT-SCHUTZ UND KATEGORIE-AUSWAHL
router.post('/items/upload', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { name, category_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    if (!category_id) {
      return res.status(400).json({ error: 'Kategorie ist erforderlich' });
    }

    const normalizedName = normalizeName(name);

    // ✅ DUPLIKAT-CHECK vor Upload
    const existing = await pool.query(
      'SELECT * FROM ingredients WHERE LOWER(TRIM(name)) = $1',
      [normalizedName]
    );

    if (existing.rows.length > 0) {
      // Lösche hochgeladene Datei falls vorhanden
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(409).json({
        error: 'Bereits vorhanden',
        message: `Produkt "${name}" existiert bereits`,
        ingredient: existing.rows[0]
      });
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

    // ✅ Verwende die vom User gewählte Kategorie
    const selectedCategory = parseInt(category_id);

    // ✅ Automatische Icon-Erkennung basierend auf Produktname
    const productIcon = detectProductIcon(name.trim());

    const ingredient = await pool.query(
      `INSERT INTO ingredients (name, icon, category_id, image_url, usage_count)
       VALUES ($1, $2, $3, $4, 1)
       RETURNING *`,
      [name.trim(), productIcon, selectedCategory, imageUrl]
    );

    console.log(`✅ Uploaded new product: ${name.trim()} → Kategorie ${selectedCategory}`);
    res.json({
      success: true,
      ingredient: ingredient.rows[0],
      message: 'Produkt erfolgreich hinzugefügt'
    });
  } catch (error) {
    console.error('Error uploading product:', error);

    // Lösche Datei bei Fehler
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: 'Fehler beim Hochladen' });
  }
});

// Toggle item
router.patch('/items/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE shopping_list_items
       SET is_checked = NOT is_checked,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    }

    // Activity Logging
    const action = result.rows[0].is_checked ? 'abgehakt' : 'wieder aktiviert';
    await logActivity({
      userId: req.user.id,
      username: req.user.displayName || req.user.username,
      actionType: result.rows[0].is_checked ? 'SHOPPING_CHECK' : 'SHOPPING_UNCHECK',
      actionDescription: `hat "${result.rows[0].name}" ${action}`,
      entityType: 'shopping_item',
      entityId: parseInt(id),
      metadata: { itemName: result.rows[0].name, checked: result.rows[0].is_checked }
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling item:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// Delete item
router.delete('/items/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM shopping_list_items WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    }

    // Activity Logging
    await logActivity({
      userId: req.user.id,
      username: req.user.displayName || req.user.username,
      actionType: 'SHOPPING_REMOVE',
      actionDescription: `hat "${result.rows[0].name}" von der Einkaufsliste entfernt`,
      entityType: 'shopping_item',
      entityId: parseInt(id),
      metadata: { itemName: result.rows[0].name }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// Get recent items
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (i.id)
        i.id,
        i.name,
        i.icon,
        i.image_url,
        c.icon as category_icon,
        c.color as category_color,
        c.name as category_name,
        i.usage_count
       FROM ingredients i
       LEFT JOIN ingredient_categories c ON i.category_id = c.id
       ORDER BY i.id, i.usage_count DESC, i.updated_at DESC
       LIMIT 30`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent items:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// Add from meal MIT DUPLIKAT-SCHUTZ
router.post('/from-meal/:mealId', authMiddleware, async (req, res) => {
  try {
    const { mealId } = req.params;
    const { week, year } = req.body;
    const currentWeek = week || getCurrentWeekNumber();
    const currentYear = year || new Date().getFullYear();

    const meal = await pool.query('SELECT * FROM meals WHERE id = $1', [mealId]);

    if (meal.rows.length === 0) {
      return res.status(404).json({ error: 'Mahlzeit nicht gefunden' });
    }

    const ingredientsText = meal.rows[0].ingredients || '';
    if (!ingredientsText.trim()) {
      return res.status(400).json({
        error: 'Keine Zutaten'
      });
    }

    const ingredients = parseIngredients(ingredientsText);

    let list = await pool.query(
      'SELECT * FROM shopping_lists WHERE week_number = $1 AND year = $2',
      [currentWeek, currentYear]
    );

    if (list.rows.length === 0) {
      list = await pool.query(
        'INSERT INTO shopping_lists (week_number, year) VALUES ($1, $2) RETURNING *',
        [currentWeek, currentYear]
      );
    }

    const addedItems = [];
    const skippedItems = [];
    
    for (const ingredient of ingredients) {
      const normalizedName = normalizeName(ingredient.name);
      
      // ✅ DUPLIKAT-CHECK
      const existing = await pool.query(
        `SELECT * FROM shopping_list_items 
         WHERE shopping_list_id = $1 
         AND LOWER(TRIM(name)) = $2 
         AND is_checked = false`,
        [list.rows[0].id, normalizedName]
      );

      if (existing.rows.length > 0) {
        skippedItems.push(ingredient.name);
        continue;
      }

      let ingredientRecord = await pool.query(
        'SELECT * FROM ingredients WHERE LOWER(TRIM(name)) = $1',
        [normalizedName]
      );

      let ingredientId = null;
      let categoryId = null;

      if (ingredientRecord.rows.length > 0) {
        ingredientId = ingredientRecord.rows[0].id;
        categoryId = ingredientRecord.rows[0].category_id;
        
        await pool.query(
          'UPDATE ingredients SET usage_count = usage_count + 1 WHERE id = $1',
          [ingredientId]
        );
      } else {
        categoryId = await detectCategory(ingredient.name);
        const productIcon = detectProductIcon(ingredient.name);
        const newIngredient = await pool.query(
          'INSERT INTO ingredients (name, icon, category_id, usage_count) VALUES ($1, $2, $3, 1) RETURNING *',
          [ingredient.name, productIcon, categoryId]
        );
        ingredientId = newIngredient.rows[0].id;
      }

      const result = await pool.query(
        `INSERT INTO shopping_list_items
         (shopping_list_id, meal_id, ingredient_id, name, category_id, is_checked)
         VALUES ($1, $2, $3, $4, $5, false)
         RETURNING *`,
        [list.rows[0].id, mealId, ingredientId, ingredient.name, categoryId]
      );
      addedItems.push(result.rows[0]);

      // Activity Logging
      await logActivity({
        userId: req.user.id,
        username: req.user.displayName || req.user.username,
        actionType: 'SHOPPING_ADD',
        actionDescription: `hat "${ingredient.name}" zur Einkaufsliste hinzugefügt (aus Menüplan)`,
        entityType: 'shopping_item',
        entityId: result.rows[0].id,
        metadata: { itemName: ingredient.name, week: currentWeek, year: currentYear, fromMeal: mealId, mealName: meal.rows[0].meal_name }
      });
    }

    const message = skippedItems.length > 0 
      ? `${addedItems.length} hinzugefügt, ${skippedItems.length} bereits vorhanden` 
      : `${addedItems.length} Zutaten hinzugefügt`;

    res.json({
      success: true,
      added: addedItems.length,
      skipped: skippedItems.length,
      skippedItems: skippedItems,
      items: addedItems,
      message: message
    });
  } catch (error) {
    console.error('Error adding meal ingredients:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen der Zutaten' });
  }
});

// Helper: Parse ingredients
function parseIngredients(text) {
  const lines = text.split(/[,\n]/);
  const ingredients = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-ZäöüÄÖÜß]+)?\s+(.+)$/);

    if (match) {
      ingredients.push({
        quantity: parseFloat(match[1].replace(',', '.')),
        unit: match[2] || 'Stück',
        name: match[3].trim()
      });
    } else {
      ingredients.push({
        quantity: 1,
        unit: 'Stück',
        name: trimmed
      });
    }
  }

  return ingredients;
}

// Helper: Week number
function getCurrentWeekNumber() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ============================================
// KATEGORIE-ERKENNUNG
// ============================================
async function detectCategory(name) {
  const lowerName = name.toLowerCase();

  const categories = {
    1: ['apfel', 'äpfel', 'banane', 'orange', 'zitrone', 'tomate', 'gurke', 'salat', 'paprika', 'zwiebel', 'karotte', 'kartoffel', 'obst', 'gemüse', 'fruit', 'vegetable'],
    2: ['milch', 'butter', 'käse', 'joghurt', 'sahne', 'quark', 'ei', 'eier', 'dairy', 'milk', 'cheese', 'yogurt'],
    3: ['brot', 'brötchen', 'toast', 'mehl', 'bread', 'bakery'],
    4: ['fleisch', 'hähnchen', 'chicken', 'schwein', 'rind', 'hack', 'wurst', 'lachs', 'fisch', 'meat', 'fish'],
    5: ['wasser', 'saft', 'cola', 'bier', 'wein', 'kaffee', 'tee', 'drink', 'beverage', 'energy', 'redbull', 'red bull', 'monster', 'rockstar'],
    6: ['salz', 'pfeffer', 'zucker', 'öl', 'essig', 'ketchup', 'senf', 'sauce', 'spice'],
    7: ['schokolade', 'keks', 'süß', 'bonbon', 'candy', 'sweet'],
    8: ['pizza', 'eis', 'tk', 'pommes', 'frozen'],
    9: ['toilettenpapier', 'klopapier', 'spülmittel', 'household'],
  };

  for (const [categoryId, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerName.includes(keyword))) {
      return parseInt(categoryId);
    }
  }

  return 10; // Sonstiges
}

// ============================================
// PRODUKT-ICON ERKENNUNG
// ============================================
function detectProductIcon(name) {
  const lowerName = name.toLowerCase();
  
  const iconMap = {
    '🍎': ['apfel', 'äpfel', 'apple'],
    '🍌': ['banane', 'banana'],
    '🍅': ['tomate', 'tomato'],
    '🥒': ['gurke', 'cucumber'],
    '🫑': ['paprika', 'pepper'],
    '🧅': ['zwiebel', 'onion'],
    '🥔': ['kartoffel', 'potato'],
    '🥕': ['karotte', 'möhre', 'carrot'],
    '🥬': ['salat', 'lettuce'],
    '🍋': ['zitrone', 'lemon'],
    '🥛': ['milch', 'milk', 'joghurt', 'sahne', 'quark'],
    '🧈': ['butter'],
    '🧀': ['käse', 'cheese'],
    '🥚': ['ei', 'eier', 'egg'],
    '🍞': ['brot', 'bread', 'toast'],
    '🥖': ['brötchen', 'baguette'],
    '🍗': ['hähnchen', 'chicken'],
    '🥩': ['hack', 'beef', 'rind', 'steak'],
    '🐟': ['lachs', 'fish', 'fisch'],
    '🌭': ['wurst', 'sausage'],
    '💧': ['wasser', 'water'],
    '🧃': ['saft', 'juice'],
    '☕': ['kaffee', 'coffee'],
    '🍵': ['tee', 'tea'],
    '🥤': ['cola', 'energy', 'redbull', 'red bull', 'monster', 'rockstar'],
    '🍺': ['bier', 'beer'],
    '🧂': ['salz', 'salt', 'pfeffer', 'pepper'],
    '🍬': ['zucker', 'sugar'],
    '🫒': ['olivenöl', 'oil', 'öl'],
    '🫗': ['essig', 'vinegar'],
    '🍅': ['ketchup'],
    '🌭': ['senf', 'mustard'],
    '🍫': ['schokolade', 'chocolate'],
    '🍪': ['keks', 'cookie'],
    '🍬': ['gummibär', 'bonbon', 'candy'],
    '🍕': ['pizza'],
    '🍦': ['eis', 'ice cream'],
    '🍟': ['pommes', 'fries'],
    '🧻': ['toilettenpapier', 'klopapier', 'küchenrolle'],
    '🧴': ['spülmittel'],
    '🍝': ['nudel', 'pasta', 'spaghetti'],
    '🍚': ['reis', 'rice'],
  };
  
  for (const [icon, keywords] of Object.entries(iconMap)) {
    if (keywords.some(keyword => lowerName.includes(keyword))) {
      return icon;
    }
  }
  
  return null;
}

module.exports = router;