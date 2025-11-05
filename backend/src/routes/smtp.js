const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');
const emailService = require('../services/emailService');
const cryptoService = require('../services/cryptoService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Get SMTP Settings (Admin only)
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Nur Admins haben Zugriff' });
    }

    const result = await pool.query('SELECT * FROM smtp_settings ORDER BY id DESC LIMIT 1');

    if (result.rows.length === 0) {
      return res.json({
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_password: '',
        sender_email: '',
        sender_name: 'Wochenplaner',
        smtp_secure: false,
        enabled: false,
        daily_menu_enabled: true,
        weekly_reminder_enabled: true
      });
    }

    // Don't send password to frontend
    const settings = result.rows[0];
    delete settings.smtp_password;

    res.json(settings);
  } catch (error) {
    console.error('Error getting SMTP settings:', error);
    res.status(500).json({ error: 'Fehler beim Laden der SMTP-Einstellungen' });
  }
});

// Update SMTP Settings (Admin only)
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Nur Admins haben Zugriff' });
    }

    const {
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      sender_email,
      sender_name,
      smtp_secure,
      enabled,
      daily_menu_enabled,
      weekly_reminder_enabled
    } = req.body;

    // Get current settings
    const current = await pool.query('SELECT * FROM smtp_settings ORDER BY id DESC LIMIT 1');

    let query, values;

    // 🔒 Verschlüssele das Passwort, wenn ein neues übergeben wurde
    let encryptedPassword;
    if (smtp_password) {
      try {
        encryptedPassword = cryptoService.encrypt(smtp_password);
        console.log('🔒 SMTP-Passwort verschlüsselt');
      } catch (error) {
        console.error('❌ Fehler beim Verschlüsseln des Passworts:', error);
        return res.status(500).json({ error: 'Fehler beim Verschlüsseln des Passworts' });
      }
    }

    if (current.rows.length === 0) {
      // Insert new settings
      query = `
        INSERT INTO smtp_settings (
          smtp_host, smtp_port, smtp_user, smtp_password,
          sender_email, sender_name, smtp_secure, enabled,
          daily_menu_enabled, weekly_reminder_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      values = [
        smtp_host, smtp_port, smtp_user, encryptedPassword || '',
        sender_email, sender_name, smtp_secure, enabled,
        daily_menu_enabled, weekly_reminder_enabled
      ];
    } else {
      // Update existing settings - behalte altes Passwort wenn kein neues übergeben
      const passwordValue = encryptedPassword || current.rows[0].smtp_password;

      query = `
        UPDATE smtp_settings SET
          smtp_host = $1,
          smtp_port = $2,
          smtp_user = $3,
          smtp_password = $4,
          sender_email = $5,
          sender_name = $6,
          smtp_secure = $7,
          enabled = $8,
          daily_menu_enabled = $9,
          weekly_reminder_enabled = $10,
          updated_at = NOW()
        WHERE id = $11
        RETURNING *
      `;
      values = [
        smtp_host, smtp_port, smtp_user, passwordValue,
        sender_email, sender_name, smtp_secure, enabled,
        daily_menu_enabled, weekly_reminder_enabled, current.rows[0].id
      ];
    }

    const result = await pool.query(query, values);
    const settings = result.rows[0];
    delete settings.smtp_password;

    res.json(settings);
  } catch (error) {
    console.error('Error updating SMTP settings:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der SMTP-Einstellungen' });
  }
});

// Test SMTP Connection (Admin only)
router.post('/test', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Nur Admins haben Zugriff' });
    }

    const result = await emailService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Error testing SMTP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send Test Email (Admin only)
router.post('/send-test', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Nur Admins haben Zugriff' });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email-Adresse erforderlich' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Ungültige Email-Adresse' });
    }

    const result = await emailService.sendTestEmail(email);
    res.json(result);
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
