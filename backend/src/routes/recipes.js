const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Multer configuration for recipe images
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/recipes');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'recipe-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Bilder (JPEG, PNG, WebP) sind erlaubt'));
    }
  }
});

// Get all recipes with optional filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, difficulty, created_by } = req.query;

    let query = `
      SELECT r.*, u.username as creator_name,
             COUNT(DISTINCT ri.id) as ingredient_count,
             COUNT(DISTINCT rs.id) as step_count
      FROM recipes r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      LEFT JOIN recipe_steps rs ON r.id = rs.recipe_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND LOWER(r.name) LIKE LOWER($${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (difficulty) {
      query += ` AND r.difficulty = $${paramCount}`;
      params.push(difficulty);
      paramCount++;
    }

    if (created_by) {
      query += ` AND r.created_by = $${paramCount}`;
      params.push(created_by);
      paramCount++;
    }

    query += ` GROUP BY r.id, u.username ORDER BY r.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Rezepte' });
  }
});

// Get single recipe with all details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Get recipe
    const recipeResult = await pool.query(`
      SELECT r.*, u.username as creator_name
      FROM recipes r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = $1
    `, [id]);

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rezept nicht gefunden' });
    }

    const recipe = recipeResult.rows[0];

    // Get ingredients
    const ingredientsResult = await pool.query(`
      SELECT ri.*, i.name as ingredient_name, i.icon, i.category_id
      FROM recipe_ingredients ri
      LEFT JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = $1
      ORDER BY ri.id
    `, [id]);

    // Get steps
    const stepsResult = await pool.query(`
      SELECT * FROM recipe_steps
      WHERE recipe_id = $1
      ORDER BY step_number
    `, [id]);

    recipe.ingredients = ingredientsResult.rows;
    recipe.steps = stepsResult.rows;

    res.json(recipe);
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Rezepts' });
  }
});

// Create new recipe
router.post('/', authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      name,
      description,
      servings,
      prep_time,
      cook_time,
      difficulty,
      image_path,
      source_url,
      ingredients,
      steps
    } = req.body;

    // DUPLIKAT-CHECK: Prüfe ob Rezept mit diesem Namen bereits existiert
    const existingRecipe = await client.query(
      'SELECT id, name FROM recipes WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name]
    );

    if (existingRecipe.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Rezept existiert bereits',
        details: `Ein Rezept mit dem Namen "${name}" wurde bereits importiert.`
      });
    }

    // Insert recipe
    const recipeResult = await client.query(`
      INSERT INTO recipes (
        name, description, servings, prep_time, cook_time,
        difficulty, image_path, source_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      name,
      description || null,
      servings || 4,
      prep_time || null,
      cook_time || null,
      difficulty || 'medium',
      image_path || null,
      source_url || null,
      req.user.id
    ]);

    const recipe = recipeResult.rows[0];

    // Insert ingredients
    if (ingredients && ingredients.length > 0) {
      for (const ing of ingredients) {
        let ingredientId = ing.ingredient_id;

        // Wenn ingredient_name angegeben ist, erstelle/finde Zutat
        if (ing.ingredient_name && !ingredientId) {
          const existingIng = await client.query(
            'SELECT id FROM ingredients WHERE LOWER(name) = LOWER($1) LIMIT 1',
            [ing.ingredient_name.trim()]
          );

          if (existingIng.rows.length > 0) {
            ingredientId = existingIng.rows[0].id;
          } else {
            const newIng = await client.query(
              'INSERT INTO ingredients (name, category_id) VALUES ($1, $2) RETURNING id',
              [ing.ingredient_name.trim(), 1] // Default category
            );
            ingredientId = newIng.rows[0].id;
          }
        }

        if (ingredientId) {
          await client.query(`
            INSERT INTO recipe_ingredients (
              recipe_id, ingredient_id, amount, unit, notes
            ) VALUES ($1, $2, $3, $4, $5)
          `, [recipe.id, ingredientId, ing.amount, ing.unit, ing.notes || null]);
        }
      }
    }

    // Insert steps
    if (steps && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        await client.query(`
          INSERT INTO recipe_steps (
            recipe_id, step_number, instruction, image_path
          ) VALUES ($1, $2, $3, $4)
        `, [recipe.id, i + 1, steps[i].instruction, steps[i].image_path || null]);
      }
    }

    await client.query('COMMIT');

    // Return full recipe
    const fullRecipe = await pool.query(`
      SELECT r.*, u.username as creator_name
      FROM recipes r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = $1
    `, [recipe.id]);

    res.status(201).json(fullRecipe.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create recipe error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Rezepts' });
  } finally {
    client.release();
  }
});

// Update recipe
router.put('/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      name,
      description,
      servings,
      prep_time,
      cook_time,
      difficulty,
      image_path,
      source_url,
      ingredients,
      steps
    } = req.body;

    // Update recipe
    const updateResult = await client.query(`
      UPDATE recipes SET
        name = $1,
        description = $2,
        servings = $3,
        prep_time = $4,
        cook_time = $5,
        difficulty = $6,
        image_path = $7,
        source_url = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [name, description, servings, prep_time, cook_time, difficulty, image_path, source_url, id]);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rezept nicht gefunden' });
    }

    // Delete and recreate ingredients
    await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);

    if (ingredients && ingredients.length > 0) {
      for (const ing of ingredients) {
        let ingredientId = ing.ingredient_id;

        // Wenn ingredient_name angegeben ist, erstelle/finde Zutat (wie bei Create)
        if (ing.ingredient_name && !ingredientId) {
          const existingIng = await client.query(
            'SELECT id FROM ingredients WHERE LOWER(name) = LOWER($1) LIMIT 1',
            [ing.ingredient_name.trim()]
          );

          if (existingIng.rows.length > 0) {
            ingredientId = existingIng.rows[0].id;
          } else {
            const newIng = await client.query(
              'INSERT INTO ingredients (name, category_id) VALUES ($1, $2) RETURNING id',
              [ing.ingredient_name.trim(), 1] // Default category
            );
            ingredientId = newIng.rows[0].id;
          }
        }

        if (ingredientId) {
          await client.query(`
            INSERT INTO recipe_ingredients (
              recipe_id, ingredient_id, amount, unit, notes
            ) VALUES ($1, $2, $3, $4, $5)
          `, [id, ingredientId, ing.amount, ing.unit, ing.notes || null]);
        }
      }
    }

    // Delete and recreate steps
    await client.query('DELETE FROM recipe_steps WHERE recipe_id = $1', [id]);

    if (steps && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        await client.query(`
          INSERT INTO recipe_steps (
            recipe_id, step_number, instruction, image_path
          ) VALUES ($1, $2, $3, $4)
        `, [id, i + 1, steps[i].instruction, steps[i].image_path || null]);
      }
    }

    await client.query('COMMIT');
    res.json(updateResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update recipe error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Rezepts' });
  } finally {
    client.release();
  }
});

// Delete recipe
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM recipes WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rezept nicht gefunden' });
    }

    res.json({ message: 'Rezept gelöscht', recipe: result.rows[0] });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Rezepts' });
  }
});

// Scale recipe portions
router.post('/:id/scale', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_servings } = req.body;

    // Get recipe with ingredients
    const recipeResult = await pool.query('SELECT * FROM recipes WHERE id = $1', [id]);

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rezept nicht gefunden' });
    }

    const recipe = recipeResult.rows[0];
    const ingredientsResult = await pool.query(`
      SELECT ri.*, i.name as ingredient_name
      FROM recipe_ingredients ri
      LEFT JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = $1
    `, [id]);

    const scale_factor = new_servings / recipe.servings;

    const scaled_ingredients = ingredientsResult.rows.map(ing => ({
      ...ing,
      amount: parseFloat(ing.amount) * scale_factor,
      original_amount: ing.amount
    }));

    res.json({
      recipe: {
        ...recipe,
        servings: new_servings,
        original_servings: recipe.servings
      },
      ingredients: scaled_ingredients,
      scale_factor
    });
  } catch (error) {
    console.error('Scale recipe error:', error);
    res.status(500).json({ error: 'Fehler beim Skalieren des Rezepts' });
  }
});

// Add recipe to week plan
router.post('/:id/add-to-week', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { day_of_week, meal_type, week_number, year } = req.body;

    // Get recipe with details
    const recipeResult = await pool.query(`
      SELECT r.*, u.username as creator_name
      FROM recipes r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = $1
    `, [id]);

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rezept nicht gefunden' });
    }

    const recipe = recipeResult.rows[0];

    // Get ingredients as text
    const ingredientsResult = await pool.query(`
      SELECT ri.amount, ri.unit, i.name
      FROM recipe_ingredients ri
      LEFT JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = $1
      ORDER BY ri.id
    `, [id]);

    const ingredientsText = ingredientsResult.rows
      .map(ing => `${ing.amount} ${ing.unit} ${ing.name}`)
      .join('\n');

    // Insert or update meal
    const mealResult = await pool.query(`
      INSERT INTO meals (
        day_of_week, meal_type, meal_name, description,
        ingredients, week_number, year, recipe_id, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (day_of_week, meal_type, week_number, year)
      DO UPDATE SET
        meal_name = EXCLUDED.meal_name,
        description = EXCLUDED.description,
        ingredients = EXCLUDED.ingredients,
        recipe_id = EXCLUDED.recipe_id,
        updated_by = EXCLUDED.user_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      day_of_week,
      meal_type,
      recipe.name,
      recipe.description,
      ingredientsText,
      week_number,
      year,
      id,
      req.user.id
    ]);

    res.json({
      message: 'Rezept zum Wochenplan hinzugefügt',
      meal: mealResult.rows[0]
    });
  } catch (error) {
    console.error('Add to week error:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen zum Wochenplan' });
  }
});

// Upload recipe image
router.post('/upload-image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    const imagePath = `/uploads/recipes/${req.file.filename}`;
    res.json({ imagePath });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Fehler beim Hochladen des Bildes' });
  }
});

module.exports = router;
