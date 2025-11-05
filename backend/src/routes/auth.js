const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Local Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND auth_type = $2',
      [username, 'local']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Benutzer ist deaktiviert' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        isAdmin: user.is_admin,
        authType: 'local'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        isAdmin: user.is_admin,
        authType: 'local'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// SSO Login - Get Auth URL
router.get('/sso/auth-url', async (req, res) => {
  try {
    const configResult = await pool.query(
      'SELECT * FROM sso_config WHERE id = 1'
    );

    if (configResult.rows.length === 0 || !configResult.rows[0].is_enabled) {
      return res.status(400).json({ error: 'SSO ist nicht konfiguriert' });
    }

    const config = configResult.rows[0];

    const authUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/authorize?` +
      `client_id=${config.client_id}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(config.redirect_uri)}` +
      `&response_mode=query` +
      `&scope=openid%20profile%20email%20User.Read`;

    res.json({ authUrl });
  } catch (error) {
    console.error('SSO auth URL error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Auth URL' });
  }
});

// SSO Callback - Exchange code for token
router.post('/sso/callback', async (req, res) => {
  try {
    const { code } = req.body;

    const configResult = await pool.query(
      'SELECT * FROM sso_config WHERE id = 1'
    );

    if (configResult.rows.length === 0) {
      return res.status(400).json({ error: 'SSO ist nicht konfiguriert' });
    }

    const config = configResult.rows[0];

    // 🔓 Entschlüssele das Client Secret
    let decryptedClientSecret;
    try {
      if (config.client_secret) {
        const cryptoService = require('../services/cryptoService');
        decryptedClientSecret = cryptoService.decrypt(config.client_secret);
        console.log('🔓 SSO Client Secret für Callback entschlüsselt');
      }
    } catch (error) {
      console.error('❌ Fehler beim Entschlüsseln des Client Secrets:', error.message);
      return res.status(500).json({
        error: 'Client Secret konnte nicht entschlüsselt werden',
        details: error.message
      });
    }

    // Exchange code for token
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: config.client_id,
        client_secret: decryptedClientSecret,
        code: code,
        redirect_uri: config.redirect_uri,
        grant_type: 'authorization_code'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get user info from Microsoft Graph
    const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const msUser = userResponse.data;

    // Upsert SSO-User anhand (email, auth_type)
    const email = msUser.mail || msUser.userPrincipalName;
    const upsert = await pool.query(
      `INSERT INTO users (username, email, display_name, auth_type, is_admin, is_active, sso_id, last_login)
       VALUES ($1, $2, $3, 'sso', false, true, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (email, auth_type)
       DO UPDATE SET
         display_name = EXCLUDED.display_name,
         sso_id       = EXCLUDED.sso_id,
         last_login   = CURRENT_TIMESTAMP
       RETURNING *`,
      [msUser.userPrincipalName, email, msUser.displayName, msUser.id]
    );
    const user = upsert.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Benutzer ist deaktiviert' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        isAdmin: user.is_admin,
        authType: 'sso'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        isAdmin: user.is_admin,
        authType: 'sso'
      }
    });
  } catch (error) {
    console.error('SSO callback error:', error);
    res.status(500).json({ error: 'SSO Login fehlgeschlagen' });
  }
});

// Verify Token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Kein Token vorhanden' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      'SELECT id, username, email, display_name, is_admin, auth_type FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({
      valid: true,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        displayName: result.rows[0].display_name,
        isAdmin: result.rows[0].is_admin,
        authType: result.rows[0].auth_type
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Ungültiger Token' });
  }
});

module.exports = router;
