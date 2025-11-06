const Database = require('better-sqlite3');
const path = require('path');

// SQLite-Datenbank im Container (/app/data)
const DB_PATH = path.join(__dirname, '../../data/training.db');

let db = null;

const initTrainingDB = () => {
  console.log('🧠 Initialisiere Training-Datenbank (SQLite)...');

  // Erstelle Datenbank-Verbindung
  db = new Database(DB_PATH);

  // Aktiviere WAL-Mode für bessere Concurrent-Performance
  db.pragma('journal_mode = WAL');

  // ============================================
  // TRAINING DATA TABLE
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS pdf_training_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_text TEXT NOT NULL,
      parsed_result TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('ai-claude', 'ai-openai', 'regex', 'hybrid')),
      confidence_score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      pdf_filename TEXT,
      pdf_size_bytes INTEGER,
      file_type TEXT DEFAULT 'pdf' CHECK (file_type IN ('pdf', 'epub'))
    );
  `);

  // Migration: Füge file_type Spalte hinzu falls nicht vorhanden
  try {
    db.exec(`
      ALTER TABLE pdf_training_data
      ADD COLUMN file_type TEXT DEFAULT 'pdf' CHECK (file_type IN ('pdf', 'epub'));
    `);
    console.log('✅ Migration: file_type Spalte hinzugefügt');
  } catch (e) {
    // Spalte existiert bereits
    if (!e.message.includes('duplicate column')) {
      console.error('Migration Error:', e.message);
    }
  }

  // Index für schnellere Queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_training_source
    ON pdf_training_data(source);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_training_confidence
    ON pdf_training_data(confidence_score);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_training_created
    ON pdf_training_data(created_at);
  `);

  // ============================================
  // LEARNING STATS TABLE
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_pdfs_trained INTEGER DEFAULT 0,
      ai_assisted_count INTEGER DEFAULT 0,
      autonomous_count INTEGER DEFAULT 0,
      average_confidence REAL DEFAULT 0,
      learning_phase TEXT DEFAULT 'training' CHECK (learning_phase IN ('training', 'hybrid', 'autonomous')),
      last_pattern_update DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Initialisiere Learning Stats falls nicht vorhanden
  const statsCount = db.prepare('SELECT COUNT(*) as count FROM learning_stats').get();
  if (statsCount.count === 0) {
    db.prepare(`
      INSERT INTO learning_stats (
        total_pdfs_trained,
        ai_assisted_count,
        autonomous_count,
        average_confidence,
        learning_phase
      ) VALUES (0, 0, 0, 0, 'training')
    `).run();
  }

  // ============================================
  // LEARNED PATTERNS TABLE
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS learned_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern_type TEXT NOT NULL,
      pattern_regex TEXT,
      pattern_data TEXT,
      success_rate REAL DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Entferne CHECK constraint falls vorhanden (ermöglicht flexible Pattern-Types)
  // Hinweis: SQLite unterstützt keine ALTER TABLE ... DROP CONSTRAINT
  // Daher müssen wir bei Bedarf die Tabelle neu erstellen
  try {
    const hasConstraint = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'learned_patterns'").get();
    if (hasConstraint && hasConstraint.sql.includes('CHECK')) {
      console.log('🔄 Migriere learned_patterns Tabelle (entferne CHECK constraint)...');

      // Backup alte Daten
      db.exec(`
        CREATE TABLE IF NOT EXISTS learned_patterns_backup AS SELECT * FROM learned_patterns;
      `);

      // Lösche alte Tabelle
      db.exec('DROP TABLE learned_patterns;');

      // Erstelle neue ohne CHECK
      db.exec(`
        CREATE TABLE learned_patterns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pattern_type TEXT NOT NULL,
          pattern_regex TEXT,
          pattern_data TEXT,
          success_rate REAL DEFAULT 0,
          usage_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Restore Daten
      db.exec(`
        INSERT INTO learned_patterns SELECT * FROM learned_patterns_backup;
        DROP TABLE learned_patterns_backup;
      `);

      console.log('✅ Migration abgeschlossen');
    }
  } catch (migrationError) {
    console.log('⚠️ Migration nicht nötig oder bereits durchgeführt');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_patterns_type
    ON learned_patterns(pattern_type);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_patterns_success
    ON learned_patterns(success_rate);
  `);

  // ============================================
  // TRAINING SESSIONS TABLE (für Bulk-Upload-Tracking)
  // ============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS training_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      total_files INTEGER DEFAULT 0,
      processed_files INTEGER DEFAULT 0,
      failed_files INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );
  `);

  console.log('✅ Training-Datenbank initialisiert (SQLite)');
  console.log(`📁 DB-Pfad: ${DB_PATH}`);

  return db;
};

const getTrainingDB = () => {
  if (!db) {
    throw new Error('Training-Datenbank nicht initialisiert. Rufe initTrainingDB() zuerst auf.');
  }
  return db;
};

const closeTrainingDB = () => {
  if (db) {
    db.close();
    console.log('✅ Training-Datenbank geschlossen');
  }
};

module.exports = {
  initTrainingDB,
  getTrainingDB,
  closeTrainingDB
};
