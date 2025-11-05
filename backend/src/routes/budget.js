const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Get prices for an ingredient
router.get('/prices/:ingredientId', authMiddleware, async (req, res) => {
  try {
    const { ingredientId } = req.params;

    const result = await pool.query(`
      SELECT ip.*, i.name as ingredient_name
      FROM ingredient_prices ip
      JOIN ingredients i ON ip.ingredient_id = i.id
      WHERE ip.ingredient_id = $1
      ORDER BY ip.store
    `, [ingredientId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get prices error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Preise' });
  }
});

// Set/update price for an ingredient
router.post('/prices', authMiddleware, async (req, res) => {
  try {
    const { ingredient_id, store, price, unit } = req.body;

    if (!ingredient_id || !store || price === undefined) {
      return res.status(400).json({ error: 'ingredient_id, store und price sind erforderlich' });
    }

    const result = await pool.query(`
      INSERT INTO ingredient_prices (ingredient_id, store, price, unit)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (ingredient_id, store) DO UPDATE SET
        price = EXCLUDED.price,
        unit = EXCLUDED.unit,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [ingredient_id, store, price, unit || 'kg']);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Set price error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern des Preises' });
  }
});

// Delete price
router.delete('/prices/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM ingredient_prices WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preis nicht gefunden' });
    }

    res.json({ message: 'Preis gelöscht', price: result.rows[0] });
  } catch (error) {
    console.error('Delete price error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Preises' });
  }
});

// Calculate cost for a meal
router.get('/calculate-meal/:mealId', authMiddleware, async (req, res) => {
  try {
    const { mealId } = req.params;
    const { store = 'Coop' } = req.query;

    // Get meal with recipe
    const mealResult = await pool.query('SELECT * FROM meals WHERE id = $1', [mealId]);

    if (mealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mahlzeit nicht gefunden' });
    }

    const meal = mealResult.rows[0];
    let totalCost = 0;
    const ingredients = [];

    // If meal is linked to a recipe, calculate from recipe ingredients
    if (meal.recipe_id) {
      const ingredientsResult = await pool.query(`
        SELECT ri.amount, ri.unit, i.name, i.id as ingredient_id,
               ip.price, ip.unit as price_unit, ip.store
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredient_id = i.id
        LEFT JOIN ingredient_prices ip ON i.id = ip.ingredient_id AND ip.store = $1
        WHERE ri.recipe_id = $2
      `, [store, meal.recipe_id]);

      for (const ing of ingredientsResult.rows) {
        let cost = 0;
        let hasPriceData = false;

        if (ing.price) {
          // Calculate cost based on amount and unit
          let amountInPriceUnit = parseFloat(ing.amount) || 0;

          // Convert units if needed (simplified conversion)
          if (ing.unit === 'g' && ing.price_unit === 'kg') {
            amountInPriceUnit /= 1000;
          } else if (ing.unit === 'kg' && ing.price_unit === 'g') {
            amountInPriceUnit *= 1000;
          } else if (ing.unit === 'ml' && ing.price_unit === 'l') {
            amountInPriceUnit /= 1000;
          } else if (ing.unit === 'l' && ing.price_unit === 'ml') {
            amountInPriceUnit *= 1000;
          }

          cost = amountInPriceUnit * parseFloat(ing.price);
          hasPriceData = true;
        }

        totalCost += cost;

        ingredients.push({
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          price: ing.price,
          price_unit: ing.price_unit,
          cost: Math.round(cost * 100) / 100,
          has_price_data: hasPriceData
        });
      }

      // Update meal with calculated cost
      await pool.query(`
        UPDATE meals SET total_cost = $1 WHERE id = $2
      `, [Math.round(totalCost * 100) / 100, mealId]);
    }

    res.json({
      meal_id: mealId,
      meal_name: meal.meal_name,
      store: store,
      total_cost: Math.round(totalCost * 100) / 100,
      ingredients: ingredients,
      ingredients_without_price: ingredients.filter(i => !i.has_price_data).length
    });
  } catch (error) {
    console.error('Calculate meal cost error:', error);
    res.status(500).json({ error: 'Fehler beim Berechnen der Kosten' });
  }
});

// Get weekly budget
router.get('/weekly/:week/:year', authMiddleware, async (req, res) => {
  try {
    const { week, year } = req.params;
    const { store = 'Coop' } = req.query;

    // Get or create weekly budget
    let budgetResult = await pool.query(`
      SELECT * FROM weekly_budgets WHERE week_number = $1 AND year = $2
    `, [week, year]);

    if (budgetResult.rows.length === 0) {
      budgetResult = await pool.query(`
        INSERT INTO weekly_budgets (week_number, year, budget_limit, actual_cost)
        VALUES ($1, $2, 200.00, 0)
        RETURNING *
      `, [week, year]);
    }

    const budget = budgetResult.rows[0];

    // Get all meals for the week with costs
    const mealsResult = await pool.query(`
      SELECT id, day_of_week, meal_type, meal_name, total_cost, recipe_id
      FROM meals
      WHERE week_number = $1 AND year = $2
      ORDER BY
        CASE day_of_week
          WHEN 'monday' THEN 1
          WHEN 'tuesday' THEN 2
          WHEN 'wednesday' THEN 3
          WHEN 'thursday' THEN 4
          WHEN 'friday' THEN 5
          WHEN 'saturday' THEN 6
          WHEN 'sunday' THEN 7
        END,
        CASE meal_type
          WHEN 'breakfast' THEN 1
          WHEN 'lunch' THEN 2
          WHEN 'dinner' THEN 3
          WHEN 'snack' THEN 4
        END
    `, [week, year]);

    // Calculate actual cost from meals with updated prices
    let actualCost = 0;
    const mealCosts = [];

    for (const meal of mealsResult.rows) {
      const cost = parseFloat(meal.total_cost) || 0;
      actualCost += cost;

      mealCosts.push({
        meal_id: meal.id,
        day: meal.day_of_week,
        type: meal.meal_type,
        name: meal.meal_name,
        cost: Math.round(cost * 100) / 100
      });
    }

    // Update actual cost in budget
    await pool.query(`
      UPDATE weekly_budgets SET
        actual_cost = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE week_number = $2 AND year = $3
    `, [Math.round(actualCost * 100) / 100, week, year]);

    const budgetLimit = parseFloat(budget.budget_limit) || 0;
    const remaining = budgetLimit - actualCost;
    const percentageUsed = budgetLimit > 0 ? (actualCost / budgetLimit) * 100 : 0;

    res.json({
      week_number: parseInt(week),
      year: parseInt(year),
      store: store,
      budget_limit: Math.round(budgetLimit * 100) / 100,
      actual_cost: Math.round(actualCost * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentage_used: Math.round(percentageUsed * 10) / 10,
      is_over_budget: actualCost > budgetLimit,
      meal_costs: mealCosts,
      meal_count: mealsResult.rows.length
    });
  } catch (error) {
    console.error('Get weekly budget error:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Wochenbudgets' });
  }
});

// Set weekly budget limit
router.put('/weekly/:week/:year', authMiddleware, async (req, res) => {
  try {
    const { week, year } = req.params;
    const { budget_limit } = req.body;

    if (budget_limit === undefined) {
      return res.status(400).json({ error: 'budget_limit ist erforderlich' });
    }

    const result = await pool.query(`
      INSERT INTO weekly_budgets (week_number, year, budget_limit)
      VALUES ($1, $2, $3)
      ON CONFLICT (week_number, year) DO UPDATE SET
        budget_limit = EXCLUDED.budget_limit,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [week, year, budget_limit]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Set weekly budget error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern des Budgets' });
  }
});

// Get all ingredient prices with statistics
router.get('/prices', authMiddleware, async (req, res) => {
  try {
    const { store } = req.query;

    let query = `
      SELECT ip.*, i.name as ingredient_name, i.icon, ic.name as category_name
      FROM ingredient_prices ip
      JOIN ingredients i ON ip.ingredient_id = i.id
      LEFT JOIN ingredient_categories ic ON i.category_id = ic.id
      WHERE 1=1
    `;

    const params = [];
    if (store) {
      query += ` AND ip.store = $1`;
      params.push(store);
    }

    query += ` ORDER BY ic.sort_order, i.name`;

    const result = await pool.query(query, params);

    // Get stores list
    const storesResult = await pool.query(`
      SELECT DISTINCT store FROM ingredient_prices ORDER BY store
    `);

    res.json({
      prices: result.rows,
      stores: storesResult.rows.map(r => r.store)
    });
  } catch (error) {
    console.error('Get all prices error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Preise' });
  }
});

// Get budget history (last 8 weeks)
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT week_number, year, budget_limit, actual_cost,
             CASE
               WHEN actual_cost > budget_limit THEN true
               ELSE false
             END as over_budget
      FROM weekly_budgets
      ORDER BY year DESC, week_number DESC
      LIMIT 8
    `);

    res.json(result.rows.reverse()); // Oldest first
  } catch (error) {
    console.error('Get budget history error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Budget-Historie' });
  }
});

module.exports = router;
