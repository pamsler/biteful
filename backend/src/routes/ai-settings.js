const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { Pool } = require('pg');
const crypto = require('../services/cryptoService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET - AI Settings abrufen (nur für Admins)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_settings LIMIT 1');

    if (result.rows.length === 0) {
      return res.json({
        provider: 'claude',
        api_key: '',
        enabled: false,
        has_api_key: false
      });
    }

    const settings = result.rows[0];

    // Entschlüssele nur für Admin-Anzeige (teilweise maskiert)
    let api_key = '';

    if (settings.api_key) {
      try {
        const decryptedKey = crypto.decrypt(settings.api_key);
        api_key = decryptedKey.substring(0, 10) + '***'; // Zeige nur erste 10 Zeichen
      } catch (error) {
        console.error('Decrypt api_key error:', error);
      }
    }

    res.json({
      provider: settings.provider,
      api_key,
      enabled: settings.enabled,
      has_api_key: !!settings.api_key,
      force_autonomous: settings.force_autonomous || false
    });
  } catch (error) {
    console.error('Get AI settings error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der AI Einstellungen' });
  }
});

// PUT - AI Settings aktualisieren (nur für Admins)
router.put('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { provider, api_key, enabled, force_autonomous } = req.body;

    // Validiere Provider
    if (provider && !['claude', 'openai'].includes(provider)) {
      return res.status(400).json({ error: 'Ungültiger Provider. Nur "claude" oder "openai" erlaubt.' });
    }

    // ✅ FIX: Wenn kein API Key gesendet wurde, behalte den vorhandenen
    if (api_key !== undefined) {
      // Neuer Key wurde gesendet - verschlüssele und speichere
      const encryptedApiKey = api_key ? crypto.encrypt(api_key) : '';

      await pool.query(`
        UPDATE ai_settings
        SET
          provider = $1,
          api_key = $2,
          enabled = $3,
          force_autonomous = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT MIN(id) FROM ai_settings)
      `, [provider || 'claude', encryptedApiKey, enabled, force_autonomous || false]);

      console.log('✅ AI API Key aktualisiert');
    } else {
      // Kein Key gesendet - nur provider und enabled aktualisieren
      await pool.query(`
        UPDATE ai_settings
        SET
          provider = $1,
          enabled = $2,
          force_autonomous = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT MIN(id) FROM ai_settings)
      `, [provider || 'claude', enabled, force_autonomous || false]);

      console.log('✅ AI Settings aktualisiert');
    }

    res.json({
      message: 'AI Einstellungen erfolgreich gespeichert',
      provider: provider || 'claude',
      enabled: enabled
    });
  } catch (error) {
    console.error('Update AI settings error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der AI Einstellungen' });
  }
});

// GET - AI Settings für interne Nutzung (entschlüsselt)
router.get('/internal', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_settings LIMIT 1');

    if (result.rows.length === 0 || !result.rows[0].enabled) {
      return res.json({
        provider: null,
        api_key: null,
        enabled: false
      });
    }

    const settings = result.rows[0];

    // Entschlüssele vollständig für interne Nutzung
    let api_key = null;

    if (settings.api_key) {
      try {
        api_key = crypto.decrypt(settings.api_key);
      } catch (error) {
        console.error('Decrypt api_key error:', error);
      }
    }

    res.json({
      provider: settings.provider,
      api_key,
      enabled: settings.enabled
    });
  } catch (error) {
    console.error('Get internal AI settings error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der AI Einstellungen' });
  }
});

module.exports = router;
