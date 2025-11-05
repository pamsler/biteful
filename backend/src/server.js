const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { initTrainingDB } = require('./db/training-db');
const { logActivity } = require('./services/activity-logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8570;

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Database
async function initializeDatabase() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash TEXT,
        display_name VARCHAR(255),
        auth_type VARCHAR(20) NOT NULL DEFAULT 'local',
        is_admin BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        sso_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'users_email_key'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_email_key;
        END IF;
      END$$;
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_auth_type_key
      ON users (email, auth_type);
    `);

    // SSO Config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sso_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        is_enabled BOOLEAN DEFAULT false,
        tenant_id VARCHAR(255),
        client_id VARCHAR(255),
        client_secret TEXT,
        redirect_uri TEXT,
        button_text VARCHAR(255) DEFAULT 'Mit Microsoft anmelden',
        allowed_groups JSONB DEFAULT '[]'::jsonb,
        frontend_url VARCHAR(255),
        last_sync TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Meals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        day_of_week VARCHAR(20) NOT NULL,
        meal_type VARCHAR(20) NOT NULL,
        meal_name VARCHAR(255) NOT NULL,
        description TEXT,
        ingredients TEXT,
        week_number INTEGER DEFAULT EXTRACT(WEEK FROM CURRENT_DATE),
        year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_TIMESTAMP),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMP,
        UNIQUE(day_of_week, meal_type, week_number, year)
      );
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname LIKE '%user_id%day_of_week%'
        ) THEN
          ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_user_id_day_of_week_meal_type_week_number_year_key;
        END IF;
      END$$;
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='meals' AND column_name='updated_by'
        ) THEN
          ALTER TABLE meals ADD COLUMN updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='meals' AND column_name='updated_at'
        ) THEN
          ALTER TABLE meals ADD COLUMN updated_at TIMESTAMP;
        END IF;
      END$$;
    `);

    // Create system admin if not exists
    const adminCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [process.env.ADMIN_USERNAME || 'admin']
    );

    if (adminCheck.rows.length === 0) {
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      await pool.query(
        `INSERT INTO users (username, email, password_hash, display_name, auth_type, is_admin, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          process.env.ADMIN_USERNAME || 'admin',
          process.env.ADMIN_EMAIL || 'admin@mealplanner.local',
          passwordHash,
          'System Administrator',
          'local',
          true,
          true
        ]
      );
      console.log('✅ System Admin erstellt:', process.env.ADMIN_USERNAME || 'admin');
    }

    console.log('✅ Database initialized successfully');
    console.log('👨‍👩‍👧‍👦 FAMILIEN-MODUS: Alle Benutzer teilen die gleichen Wochenpläne');
    
    // ============================================
    // EINKAUFSLISTEN TABELLEN - VOLLSTÄNDIG! 🛒
    // ============================================
    
    // Ingredient Categories
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingredient_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        icon VARCHAR(50),
        color VARCHAR(50),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Ingredients Cache - MIT ICON SPALTE! 🎨
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        icon VARCHAR(10),
        category_id INTEGER REFERENCES ingredient_categories(id) ON DELETE SET NULL,
        default_unit VARCHAR(50) DEFAULT 'Stück',
        barcode VARCHAR(50),
        image_url TEXT,
        product_id VARCHAR(100),
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Füge icon Spalte hinzu falls nicht vorhanden
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='ingredients' AND column_name='icon'
        ) THEN
          ALTER TABLE ingredients ADD COLUMN icon VARCHAR(10);
        END IF;
      END$$;
    `);
    
    // Shopping Lists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shopping_lists (
        id SERIAL PRIMARY KEY,
        week_number INTEGER NOT NULL,
        year INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(week_number, year)
      );
    `);
    
    // Shopping List Items
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shopping_list_items (
        id SERIAL PRIMARY KEY,
        shopping_list_id INTEGER REFERENCES shopping_lists(id) ON DELETE CASCADE,
        meal_id INTEGER REFERENCES meals(id) ON DELETE SET NULL,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
        
        name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2),
        unit VARCHAR(50) DEFAULT 'Stück',
        category_id INTEGER REFERENCES ingredient_categories(id) ON DELETE SET NULL,
        
        is_checked BOOLEAN DEFAULT false,
        notes TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ============================================
    // REZEPT-MANAGEMENT SYSTEM 📖
    // ============================================

    // Recipes - Strukturierte Rezepte mit Zubereitungsschritten
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        servings INTEGER DEFAULT 4,
        prep_time INTEGER,
        cook_time INTEGER,
        difficulty VARCHAR(20) DEFAULT 'medium',
        image_path VARCHAR(500),
        source_url VARCHAR(500),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Recipe Steps - Zubereitungsschritte
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recipe_steps (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        instruction TEXT NOT NULL,
        image_path VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(recipe_id, step_number)
      );
    `);

    // Recipe Ingredients - Strukturierte Zutatenliste
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
        amount DECIMAL(10,2),
        unit VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ============================================
    // NÄHRWERT-TRACKING 📊
    // ============================================

    // Nutrition Goals - Benutzerdefinierte Ernährungsziele
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nutrition_goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        daily_calories INTEGER DEFAULT 2000,
        daily_protein INTEGER DEFAULT 50,
        daily_carbs INTEGER DEFAULT 250,
        daily_fat INTEGER DEFAULT 70,
        daily_fiber INTEGER DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Erweitere Ingredients mit Nährwertinformationen (per 100g)
    await pool.query(`
      ALTER TABLE ingredients
      ADD COLUMN IF NOT EXISTS calories DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS protein DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS carbs DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fat DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fiber DECIMAL(10,2) DEFAULT 0;
    `);

    // Erweitere Meals mit Rezept-Verknüpfung und Nährwerten
    await pool.query(`
      ALTER TABLE meals
      ADD COLUMN IF NOT EXISTS recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS total_calories DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_protein DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_carbs DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_fat DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_fiber DECIMAL(10,2) DEFAULT 0;
    `);

    // ============================================
    // BUDGET & KOSTENTRACKING 💰
    // ============================================

    // Ingredient Prices - Produktpreise von verschiedenen Geschäften
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingredient_prices (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
        store VARCHAR(100) DEFAULT 'Coop',
        price DECIMAL(10,2) NOT NULL,
        unit VARCHAR(50) DEFAULT 'kg',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ingredient_id, store)
      );
    `);

    // Weekly Budgets - Wochenbudgets mit Ist-Kosten
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weekly_budgets (
        id SERIAL PRIMARY KEY,
        week_number INTEGER NOT NULL,
        year INTEGER NOT NULL,
        budget_limit DECIMAL(10,2) DEFAULT 200.00,
        actual_cost DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(week_number, year)
      );
    `);

    // Erweitere Meals mit Kosteninformation
    await pool.query(`
      ALTER TABLE meals
      ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,2) DEFAULT 0;
    `);

    // ============================================
    // ACTIVITY LOGS - Nachvollziehbarkeit 📋
    // ============================================

    // Activity Logs - Alle Benutzeraktionen protokollieren
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(255) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        action_description TEXT NOT NULL,
        entity_type VARCHAR(100),
        entity_id INTEGER,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indizes für bessere Performance bei Activity Logs
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
      ON activity_logs(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
      ON activity_logs(created_at DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type
      ON activity_logs(action_type);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
      ON activity_logs(entity_type, entity_id);
    `);

    console.log('✅ Rezept-Management Tabellen erstellt 📖');
    console.log('✅ Nährwert-Tracking aktiviert 📊');
    console.log('✅ Budget-Tracking aktiviert 💰');
    console.log('✅ Activity Logs aktiviert 📋');

    // Standard-Kategorien
    await pool.query(`
      INSERT INTO ingredient_categories (name, icon, color, sort_order) VALUES
        ('Obst & Gemüse', '🍎', '#4ADE80', 1),
        ('Milchprodukte', '🥛', '#60A5FA', 2),
        ('Brot & Backwaren', '🥖', '#F59E0B', 3),
        ('Fleisch & Fisch', '🥩', '#EF4444', 4),
        ('Getränke', '🥤', '#8B5CF6', 5),
        ('Gewürze & Soßen', '🧂', '#EC4899', 6),
        ('Süßigkeiten', '🍫', '#A855F7', 7),
        ('Tiefkühlkost', '🧊', '#06B6D4', 8),
        ('Haushalt', '🧹', '#6B7280', 9),
        ('Sonstiges', '📦', '#9CA3AF', 10)
      ON CONFLICT (name) DO NOTHING;
    `);
    
    // Starter-Lebensmittel MIT produkt-spezifischen Emojis! 🎨
    await pool.query(`
      INSERT INTO ingredients (name, icon, category_id, default_unit, usage_count) VALUES
        -- Obst & Gemüse
        ('Äpfel', '🍎', 1, 'kg', 100),
        ('Bananen', '🍌', 1, 'kg', 100),
        ('Tomaten', '🍅', 1, 'kg', 90),
        ('Gurken', '🥒', 1, 'Stück', 85),
        ('Paprika', '🫑', 1, 'Stück', 80),
        ('Zwiebeln', '🧅', 1, 'kg', 95),
        ('Kartoffeln', '🥔', 1, 'kg', 90),
        ('Karotten', '🥕', 1, 'kg', 85),
        ('Salat', '🥬', 1, 'Stück', 80),
        ('Zitronen', '🍋', 1, 'Stück', 75),
        
        -- Milchprodukte
        ('Milch', '🥛', 2, 'l', 100),
        ('Butter', '🧈', 2, 'g', 90),
        ('Käse', '🧀', 2, 'g', 85),
        ('Joghurt', '🥛', 2, 'Stück', 80),
        ('Sahne', '🥛', 2, 'ml', 75),
        ('Quark', '🥛', 2, 'g', 70),
        ('Eier', '🥚', 2, 'Stück', 95),
        
        -- Brot & Backwaren
        ('Brot', '🍞', 3, 'Stück', 100),
        ('Brötchen', '🥖', 3, 'Stück', 90),
        ('Toast', '🍞', 3, 'Packung', 85),
        ('Mehl', '🌾', 3, 'kg', 80),
        
        -- Fleisch & Fisch
        ('Hähnchenbrust', '🍗', 4, 'g', 85),
        ('Hackfleisch', '🥩', 4, 'g', 80),
        ('Lachs', '🐟', 4, 'g', 75),
        ('Wurst', '🌭', 4, 'Packung', 70),
        
        -- Getränke
        ('Wasser', '💧', 5, 'l', 100),
        ('Orangensaft', '🧃', 5, 'l', 85),
        ('Kaffee', '☕', 5, 'Packung', 80),
        ('Tee', '🍵', 5, 'Packung', 75),
        ('Cola', '🥤', 5, 'l', 70),
        ('Bier', '🍺', 5, 'Kasten', 65),
        
        -- Gewürze & Soßen
        ('Salz', '🧂', 6, 'Packung', 90),
        ('Pfeffer', '🧂', 6, 'Packung', 85),
        ('Zucker', '🍬', 6, 'kg', 80),
        ('Olivenöl', '🫒', 6, 'l', 85),
        ('Essig', '🫗', 6, 'ml', 75),
        ('Ketchup', '🍅', 6, 'Flasche', 70),
        ('Senf', '🌭', 6, 'Glas', 65),
        
        -- Süßigkeiten
        ('Schokolade', '🍫', 7, 'Tafel', 80),
        ('Kekse', '🍪', 7, 'Packung', 75),
        ('Gummibärchen', '🍬', 7, 'Packung', 70),
        
        -- Tiefkühlkost
        ('Pizza', '🍕', 8, 'Stück', 75),
        ('Eis', '🍦', 8, 'Packung', 70),
        ('Pommes', '🍟', 8, 'Packung', 65),
        
        -- Haushalt
        ('Toilettenpapier', '🧻', 9, 'Packung', 85),
        ('Küchenrolle', '🧻', 9, 'Packung', 75),
        ('Spülmittel', '🧴', 9, 'Flasche', 70),
        
        -- Sonstiges
        ('Nudeln', '🍝', 10, 'Packung', 90),
        ('Reis', '🍚', 10, 'kg', 85)
      ON CONFLICT (name) DO UPDATE SET icon = EXCLUDED.icon;
    `);
    
    console.log('✅ Einkaufslisten-Tabellen initialisiert');
    console.log('✅ Starter-Lebensmittel mit produkt-spezifischen Emojis hinzugefügt 🎨');
    console.log('🇨🇭 Schweizer OpenFoodFacts API konfiguriert');

    // ============================================
    // SMTP SETTINGS TABELLE 📧
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS smtp_settings (
        id SERIAL PRIMARY KEY,
        smtp_host VARCHAR(255) NOT NULL,
        smtp_port INTEGER NOT NULL DEFAULT 587,
        smtp_user VARCHAR(255) NOT NULL,
        smtp_password TEXT NOT NULL,
        sender_email VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255) NOT NULL DEFAULT 'Wochenplaner',
        smtp_secure BOOLEAN DEFAULT false,
        enabled BOOLEAN DEFAULT false,
        daily_menu_enabled BOOLEAN DEFAULT true,
        weekly_reminder_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Füge default SMTP Settings hinzu falls nicht vorhanden
    const smtpCheck = await pool.query('SELECT COUNT(*) FROM smtp_settings');
    if (smtpCheck.rows[0].count === '0') {
      await pool.query(`
        INSERT INTO smtp_settings (
          smtp_host, smtp_port, smtp_user, smtp_password,
          sender_email, sender_name, enabled,
          daily_menu_enabled, weekly_reminder_enabled
        ) VALUES (
          'smtp.example.com', 587, '', '',
          'noreply@example.com', 'Wochenplaner', false,
          true, true
        );
      `);
    }

    console.log('✅ SMTP Settings Tabelle initialisiert 📧');

    // ============================================
    // AI SETTINGS TABELLE (Claude/OpenAI) 🤖
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_settings (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(20) DEFAULT 'claude',
        api_key TEXT,
        enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT provider_check CHECK (provider IN ('claude', 'openai'))
      );
    `);

    // Füge default AI Settings hinzu falls nicht vorhanden
    const aiCheck = await pool.query('SELECT COUNT(*) FROM ai_settings');
    if (aiCheck.rows[0].count === '0') {
      await pool.query(`
        INSERT INTO ai_settings (
          provider, api_key, enabled
        ) VALUES (
          'claude', '', false
        );
      `);
    }

    console.log('✅ AI Settings Tabelle initialisiert 🤖');

    // Migration: Füge force_autonomous Spalte hinzu
    await pool.query(`
      ALTER TABLE ai_settings
      ADD COLUMN IF NOT EXISTS force_autonomous BOOLEAN DEFAULT false;
    `);

    console.log('✅ Force Autonomous Setting hinzugefügt');

    // ============================================
    // PDF LEARNING SYSTEM 🧠 (SQLite)
    // ============================================
    // Training-Daten werden in separater SQLite-DB gespeichert
    initTrainingDB();
    console.log('✅ PDF Learning System initialisiert (SQLite) 🧠');

    // ============================================
    // PERFORMANCE: DATENBANK-INDEXE 🚀
    // ============================================

    // Meals - Häufigste Queries optimieren
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_meals_week_year
      ON meals(week_number, year);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_meals_day_type_week
      ON meals(day_of_week, meal_type, week_number, year);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_meals_user_id
      ON meals(user_id);
    `);

    // Shopping Lists - Wochenbasierte Abfragen
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shopping_lists_week_year
      ON shopping_lists(week_number, year);
    `);

    // Shopping List Items - Join-Optimierung
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list_id
      ON shopping_list_items(shopping_list_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shopping_list_items_ingredient_id
      ON shopping_list_items(ingredient_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shopping_list_items_checked
      ON shopping_list_items(is_checked);
    `);

    // Ingredients - Suchoptimierung
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ingredients_name_lower
      ON ingredients(LOWER(name));
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ingredients_usage_count
      ON ingredients(usage_count DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ingredients_category_id
      ON ingredients(category_id);
    `);

    // Users - Login-Optimierung
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username
      ON users(username);
    `);

    // Recipes - Suchoptimierung
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_recipes_name_lower
      ON recipes(LOWER(name));
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_recipes_created_by
      ON recipes(created_by);
    `);

    // Recipe Ingredients - Join-Optimierung
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
      ON recipe_ingredients(recipe_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id
      ON recipe_ingredients(ingredient_id);
    `);

    // Recipe Steps - Sortierung
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id_step_number
      ON recipe_steps(recipe_id, step_number);
    `);

    // Meals - Rezept-Verknüpfung
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_meals_recipe_id
      ON meals(recipe_id);
    `);

    // Ingredient Prices - Preis-Abfragen
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ingredient_prices_ingredient_id
      ON ingredient_prices(ingredient_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ingredient_prices_store
      ON ingredient_prices(store);
    `);

    // Weekly Budgets - Zeitbasierte Abfragen
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_weekly_budgets_week_year
      ON weekly_budgets(week_number, year);
    `);

    console.log('✅ Datenbank-Indexe erstellt 🚀');

  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Middleware
const compression = require('compression');

// ⚡ Performance: Response Compression (gzip/deflate)
app.use(compression({
  level: 6, // Compression level (0-9, default 6)
  threshold: 1024, // Nur Responses > 1KB komprimieren
  filter: (req, res) => {
    // Komprimiere JSON und Text-Responses
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

console.log('⚡ Response Compression aktiviert (gzip/deflate)');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const ssoRoutes = require('./routes/sso');
const shoppingRoutes = require('./routes/shopping');
const ingredientsRoutes = require('./routes/ingredients');
const { authMiddleware } = require('./middleware/auth');

// ✅ HEALTH CHECK ENDPOINT (für Docker Healthcheck)
app.get('/api/health', async (req, res) => {
  try {
    // Test DB Connection
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// API Routes
const smtpRoutes = require('./routes/smtp');
const recipesRoutes = require('./routes/recipes');
const aiSettingsRoutes = require('./routes/ai-settings');
const pdfRecipesRoutes = require('./routes/pdf-recipes');
const activityLogsRoutes = require('./routes/activity-logs');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sso', ssoRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/ingredients', ingredientsRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/ai-settings', aiSettingsRoutes);
app.use('/api/pdf-recipes', pdfRecipesRoutes);

// MEALS ROUTES
app.get('/api/meals', authMiddleware, async (req, res) => {
  try {
    const { week, year } = req.query;
    const currentWeek = week || new Date().getWeek();
    const currentYear = year || new Date().getFullYear();

    const result = await pool.query(
      `SELECT m.*, 
              u.display_name as created_by_name,
              u2.display_name as updated_by_name
       FROM meals m
       LEFT JOIN users u ON m.user_id = u.id
       LEFT JOIN users u2 ON m.updated_by = u2.id
       WHERE m.week_number = $1 AND m.year = $2 
       ORDER BY m.id`,
      [currentWeek, currentYear]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching meals:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der Mahlzeiten',
      message: 'Die Mahlzeiten konnten nicht geladen werden. Bitte versuche es erneut.' 
    });
  }
});

app.get('/api/meals/:day/:type', authMiddleware, async (req, res) => {
  try {
    const { day, type } = req.params;
    const { week, year } = req.query;
    const currentWeek = week || new Date().getWeek();
    const currentYear = year || new Date().getFullYear();

    const result = await pool.query(
      `SELECT m.*, 
              u.display_name as created_by_name,
              u2.display_name as updated_by_name
       FROM meals m
       LEFT JOIN users u ON m.user_id = u.id
       LEFT JOIN users u2 ON m.updated_by = u2.id
       WHERE m.day_of_week = $1 AND m.meal_type = $2 AND m.week_number = $3 AND m.year = $4`,
      [day, type, currentWeek, currentYear]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching meal:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der Mahlzeit',
      message: 'Die Mahlzeit konnte nicht geladen werden. Bitte versuche es erneut.' 
    });
  }
});

app.post('/api/meals', authMiddleware, async (req, res) => {
  try {
    const { day_of_week, meal_type, meal_name, description, ingredients, week_number, year } = req.body;
    const userId = req.user.id;

    if (!day_of_week || !meal_type || !meal_name) {
      return res.status(400).json({
        error: 'Ungültige Daten',
        message: 'Bitte fülle alle Pflichtfelder aus.'
      });
    }

    // Check if meal exists for activity logging
    const existingMeal = await pool.query(
      'SELECT id FROM meals WHERE day_of_week = $1 AND meal_type = $2 AND week_number = $3 AND year = $4',
      [day_of_week, meal_type, week_number, year]
    );
    const isUpdate = existingMeal.rows.length > 0;

    const result = await pool.query(
      `INSERT INTO meals (user_id, day_of_week, meal_type, meal_name, description, ingredients, week_number, year, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $1, CURRENT_TIMESTAMP)
       ON CONFLICT (day_of_week, meal_type, week_number, year)
       DO UPDATE SET
         meal_name = EXCLUDED.meal_name,
         description = EXCLUDED.description,
         ingredients = EXCLUDED.ingredients,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, day_of_week, meal_type, meal_name, description, ingredients, week_number, year]
    );

    // Activity Logging
    await logActivity({
      userId: req.user.id,
      username: req.user.displayName || req.user.username,
      actionType: isUpdate ? 'MEAL_UPDATE' : 'MEAL_CREATE',
      actionDescription: isUpdate
        ? `hat "${meal_name}" im Menüplan bearbeitet (${day_of_week}, ${meal_type})`
        : `hat "${meal_name}" zum Menüplan hinzugefügt (${day_of_week}, ${meal_type})`,
      entityType: 'meal',
      entityId: result.rows[0].id,
      metadata: {
        mealName: meal_name,
        dayOfWeek: day_of_week,
        mealType: meal_type,
        week: week_number,
        year: year
      }
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving meal:', error);

    if (error.code === '42P10') {
      return res.status(500).json({
        error: 'Datenbank-Konfigurationsfehler',
        message: 'Die Datenbank muss neu initialisiert werden. Bitte kontaktiere den Administrator.'
      });
    }

    res.status(500).json({
      error: 'Fehler beim Speichern',
      message: 'Die Mahlzeit konnte nicht gespeichert werden. Bitte versuche es erneut.'
    });
  }
});

app.delete('/api/meals/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        error: 'Ungültige ID',
        message: 'Die Mahlzeit konnte nicht gefunden werden.'
      });
    }

    const result = await pool.query('DELETE FROM meals WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Nicht gefunden',
        message: 'Die Mahlzeit existiert nicht mehr.'
      });
    }

    // Activity Logging
    const deletedMeal = result.rows[0];
    await logActivity({
      userId: req.user.id,
      username: req.user.displayName || req.user.username,
      actionType: 'MEAL_DELETE',
      actionDescription: `hat "${deletedMeal.meal_name}" aus dem Menüplan gelöscht (${deletedMeal.day_of_week}, ${deletedMeal.meal_type})`,
      entityType: 'meal',
      entityId: parseInt(id),
      metadata: {
        mealName: deletedMeal.meal_name,
        dayOfWeek: deletedMeal.day_of_week,
        mealType: deletedMeal.meal_type,
        week: deletedMeal.week_number,
        year: deletedMeal.year
      }
    });

    res.json({
      success: true,
      message: 'Mahlzeit gelöscht'
    });
  } catch (error) {
    console.error('Error deleting meal:', error);
    res.status(500).json({
      error: 'Fehler beim Löschen',
      message: 'Die Mahlzeit konnte nicht gelöscht werden. Bitte versuche es erneut.'
    });
  }
});

// Serve React App
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Helper function for week number
Date.prototype.getWeek = function() {
  const date = new Date(this.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

// Start Server
async function startServer() {
  await initializeDatabase();

  // Start Cron Service for automated emails
  const cronService = require('./services/cronService');
  cronService.start();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Meal Planner läuft auf http://localhost:${PORT}`);
    console.log(`👤 Admin User: ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(`👨‍👩‍👧‍👦 FAMILIEN-MODUS AKTIV`);
    console.log(`🛒 EINKAUFSLISTEN mit produkt-spezifischen Emojis 🎨`);
    console.log(`🇨🇭 OpenFoodFacts API bereit`);
    console.log(`📧 Email-Benachrichtigungen bereit`);
  });
}

startServer();