const express = require('express');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Get all users (Admin only)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // optionale Filter: ?onlyActive=true  &  ?authType=local|sso
    const onlyActive = req.query.onlyActive === 'true';
    const authType = (req.query.authType || '').toLowerCase(); // '', 'local', 'sso'
    const params = [];
    const where = [];
    if (onlyActive) where.push('is_active = true');
    if (authType === 'local' || authType === 'sso') {
      params.push(authType);
      where.push('auth_type = $' + params.length);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT
        id,
        username,
        email,
        COALESCE(display_name, username)           AS display_name,
        auth_type,
        is_admin,
        is_active,
        created_at,
        last_login
      FROM users
      ${whereSql}
      ORDER BY created_at DESC, id DESC
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

// Create local user (Admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { username, email, password, displayName, isAdmin } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, Email und Passwort sind erforderlich' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Benutzer existiert bereits' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name, auth_type, is_admin, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, email, display_name, auth_type, is_admin, is_active, created_at`,
      [username, email, passwordHash, displayName || username, 'local', isAdmin || false, true]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Benutzers' });
  }
});

// Update user (Admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, displayName, isAdmin, isActive } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET email = COALESCE($1, email),
           display_name = COALESCE($2, display_name),
           is_admin = COALESCE($3, is_admin),
           is_active = COALESCE($4, is_active)
       WHERE id = $5
       RETURNING id, username, email, display_name, auth_type, is_admin, is_active`,
      [email, displayName, isAdmin, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Benutzers' });
  }
});

// Reset password (Admin only)
router.post('/:id/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Passwort ist erforderlich' });
    }

    // Check if user is local
    const userCheck = await pool.query(
      'SELECT auth_type FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    if (userCheck.rows[0].auth_type !== 'local') {
      return res.status(400).json({ error: 'Passwort kann nur für lokale Benutzer geändert werden' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, id]
    );

    res.json({ message: 'Passwort erfolgreich zurückgesetzt' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Sie können sich nicht selbst löschen' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Benutzers' });
  }
});

module.exports = router;
