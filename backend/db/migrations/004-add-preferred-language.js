// Migration: Add Preferred Language Column
// Adds preferred_language column to users table for language-specific notifications

async function up(pool) {
  console.log('🔄 Running migration: Add preferred language support');

  await pool.query('BEGIN');

  try {
    // Add preferred_language column to users table
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'de'
    `);

    console.log('✅ Added preferred_language column to users table');

    // Update existing users: detect language from browser or set default
    await pool.query(`
      UPDATE users
      SET preferred_language = 'de'
      WHERE preferred_language IS NULL
    `);

    console.log('✅ Set default language for existing users');

    await pool.query('COMMIT');
    console.log('✅ Migration completed: Preferred language support added');

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function down(pool) {
  console.log('🔄 Rolling back migration: Remove preferred language support');

  await pool.query('BEGIN');

  try {
    await pool.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS preferred_language
    `);

    await pool.query('COMMIT');
    console.log('✅ Rollback completed');

  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

module.exports = { up, down };
