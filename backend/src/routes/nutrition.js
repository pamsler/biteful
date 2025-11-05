const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Get or create user nutrition goals
router.get('/goals', authMiddleware, async (req, res) => {
  try {
    let result = await pool.query(`
      SELECT * FROM nutrition_goals WHERE user_id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      // Create default goals
      result = await pool.query(`
        INSERT INTO nutrition_goals (
          user_id, daily_calories, daily_protein, daily_carbs, daily_fat, daily_fiber
        ) VALUES ($1, 2000, 50, 250, 70, 30)
        RETURNING *
      `, [req.user.id]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get nutrition goals error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Ernährungsziele' });
  }
});

// Update nutrition goals
router.put('/goals', authMiddleware, async (req, res) => {
  try {
    const { daily_calories, daily_protein, daily_carbs, daily_fat, daily_fiber } = req.body;

    const result = await pool.query(`
      INSERT INTO nutrition_goals (
        user_id, daily_calories, daily_protein, daily_carbs, daily_fat, daily_fiber
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        daily_calories = EXCLUDED.daily_calories,
        daily_protein = EXCLUDED.daily_protein,
        daily_carbs = EXCLUDED.daily_carbs,
        daily_fat = EXCLUDED.daily_fat,
        daily_fiber = EXCLUDED.daily_fiber,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [req.user.id, daily_calories, daily_protein, daily_carbs, daily_fat, daily_fiber]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update nutrition goals error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der Ernährungsziele' });
  }
});

// Calculate nutrition for a meal
router.get('/calculate-meal/:mealId', authMiddleware, async (req, res) => {
  try {
    const { mealId } = req.params;

    // Get meal with recipe
    const mealResult = await pool.query('SELECT * FROM meals WHERE id = $1', [mealId]);

    if (mealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mahlzeit nicht gefunden' });
    }

    const meal = mealResult.rows[0];

    let nutrition = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0
    };

    // If meal is linked to a recipe, calculate from recipe ingredients
    if (meal.recipe_id) {
      const ingredientsResult = await pool.query(`
        SELECT ri.amount, ri.unit, i.calories, i.protein, i.carbs, i.fat, i.fiber
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE ri.recipe_id = $1
      `, [meal.recipe_id]);

      for (const ing of ingredientsResult.rows) {
        // Nutrition values are per 100g, so calculate based on amount
        // Simplified: assume unit is in grams or convert
        let amountInGrams = parseFloat(ing.amount) || 0;

        // Convert common units to grams (simplified)
        if (ing.unit === 'kg') amountInGrams *= 1000;
        else if (ing.unit === 'l' || ing.unit === 'liter') amountInGrams *= 1000; // 1L ≈ 1kg for water-based
        else if (ing.unit === 'ml') amountInGrams *= 1; // 1ml ≈ 1g

        const factor = amountInGrams / 100; // Nutrition per 100g

        nutrition.calories += (parseFloat(ing.calories) || 0) * factor;
        nutrition.protein += (parseFloat(ing.protein) || 0) * factor;
        nutrition.carbs += (parseFloat(ing.carbs) || 0) * factor;
        nutrition.fat += (parseFloat(ing.fat) || 0) * factor;
        nutrition.fiber += (parseFloat(ing.fiber) || 0) * factor;
      }

      // Update meal with calculated nutrition
      await pool.query(`
        UPDATE meals SET
          total_calories = $1,
          total_protein = $2,
          total_carbs = $3,
          total_fat = $4,
          total_fiber = $5
        WHERE id = $6
      `, [
        Math.round(nutrition.calories),
        Math.round(nutrition.protein * 10) / 10,
        Math.round(nutrition.carbs * 10) / 10,
        Math.round(nutrition.fat * 10) / 10,
        Math.round(nutrition.fiber * 10) / 10,
        mealId
      ]);
    }

    res.json({
      meal_id: mealId,
      meal_name: meal.meal_name,
      nutrition: {
        calories: Math.round(nutrition.calories),
        protein: Math.round(nutrition.protein * 10) / 10,
        carbs: Math.round(nutrition.carbs * 10) / 10,
        fat: Math.round(nutrition.fat * 10) / 10,
        fiber: Math.round(nutrition.fiber * 10) / 10
      }
    });
  } catch (error) {
    console.error('Calculate nutrition error:', error);
    res.status(500).json({ error: 'Fehler beim Berechnen der Nährwerte' });
  }
});

// Get weekly nutrition summary
router.get('/weekly-summary/:week/:year', authMiddleware, async (req, res) => {
  try {
    const { week, year } = req.params;

    // Get all meals for the week
    const mealsResult = await pool.query(`
      SELECT day_of_week, meal_type, meal_name,
             total_calories, total_protein, total_carbs, total_fat, total_fiber
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

    // Calculate daily and weekly totals
    const dailyTotals = {};
    let weeklyTotals = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      meal_count: 0
    };

    for (const meal of mealsResult.rows) {
      if (!dailyTotals[meal.day_of_week]) {
        dailyTotals[meal.day_of_week] = {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          meals: []
        };
      }

      const calories = parseFloat(meal.total_calories) || 0;
      const protein = parseFloat(meal.total_protein) || 0;
      const carbs = parseFloat(meal.total_carbs) || 0;
      const fat = parseFloat(meal.total_fat) || 0;
      const fiber = parseFloat(meal.total_fiber) || 0;

      dailyTotals[meal.day_of_week].calories += calories;
      dailyTotals[meal.day_of_week].protein += protein;
      dailyTotals[meal.day_of_week].carbs += carbs;
      dailyTotals[meal.day_of_week].fat += fat;
      dailyTotals[meal.day_of_week].fiber += fiber;
      dailyTotals[meal.day_of_week].meals.push({
        type: meal.meal_type,
        name: meal.meal_name,
        calories,
        protein,
        carbs,
        fat,
        fiber
      });

      weeklyTotals.calories += calories;
      weeklyTotals.protein += protein;
      weeklyTotals.carbs += carbs;
      weeklyTotals.fat += fat;
      weeklyTotals.fiber += fiber;
      weeklyTotals.meal_count++;
    }

    // Get user goals
    const goalsResult = await pool.query(`
      SELECT * FROM nutrition_goals WHERE user_id = $1
    `, [req.user.id]);

    const goals = goalsResult.rows[0] || {
      daily_calories: 2000,
      daily_protein: 50,
      daily_carbs: 250,
      daily_fat: 70,
      daily_fiber: 30
    };

    // Calculate daily averages
    const daysWithMeals = Object.keys(dailyTotals).length;
    const dailyAverages = daysWithMeals > 0 ? {
      calories: Math.round(weeklyTotals.calories / daysWithMeals),
      protein: Math.round((weeklyTotals.protein / daysWithMeals) * 10) / 10,
      carbs: Math.round((weeklyTotals.carbs / daysWithMeals) * 10) / 10,
      fat: Math.round((weeklyTotals.fat / daysWithMeals) * 10) / 10,
      fiber: Math.round((weeklyTotals.fiber / daysWithMeals) * 10) / 10
    } : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

    res.json({
      week_number: parseInt(week),
      year: parseInt(year),
      daily_totals: dailyTotals,
      weekly_totals: {
        ...weeklyTotals,
        calories: Math.round(weeklyTotals.calories),
        protein: Math.round(weeklyTotals.protein * 10) / 10,
        carbs: Math.round(weeklyTotals.carbs * 10) / 10,
        fat: Math.round(weeklyTotals.fat * 10) / 10,
        fiber: Math.round(weeklyTotals.fiber * 10) / 10
      },
      daily_averages: dailyAverages,
      goals: goals,
      days_with_meals: daysWithMeals
    });
  } catch (error) {
    console.error('Weekly summary error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Wochenübersicht' });
  }
});

// Sync nutrition data from OpenFoodFacts for an ingredient
router.post('/sync-ingredient/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { calories, protein, carbs, fat, fiber } = req.body;

    const result = await pool.query(`
      UPDATE ingredients SET
        calories = $1,
        protein = $2,
        carbs = $3,
        fat = $4,
        fiber = $5
      WHERE id = $6
      RETURNING *
    `, [calories, protein, carbs, fat, fiber, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Zutat nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Sync ingredient error:', error);
    res.status(500).json({ error: 'Fehler beim Synchronisieren der Nährwerte' });
  }
});

module.exports = router;
