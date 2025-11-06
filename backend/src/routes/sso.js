const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const cryptoService = require('../services/cryptoService');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Get SSO Config (Admin only)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sso_config WHERE id = 1');

    if (result.rows.length === 0) {
      return res.json({
        isEnabled: false,
        tenantId: '',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
        buttonText: 'Mit Microsoft anmelden',
        allowedGroups: [],
        frontendUrl: ''
      });
    }

    const config = result.rows[0];

    res.json({
      isEnabled: config.is_enabled,
      tenantId: config.tenant_id,
      clientId: config.client_id,
      clientSecret: config.client_secret ? '***HIDDEN***' : '',
      redirectUri: config.redirect_uri,
      buttonText: config.button_text,
      allowedGroups: config.allowed_groups || [],
      frontendUrl: config.frontend_url,
      lastSync: config.last_sync
    });
  } catch (error) {
    console.error('Get SSO config error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der SSO Konfiguration' });
  }
});

// Update SSO Config (Admin only)
router.put('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      isEnabled,
      tenantId,
      clientId,
      clientSecret,
      redirectUri,
      buttonText,
      allowedGroups,
      frontendUrl
    } = req.body;

    // 🔒 Verschlüssele das Client Secret, wenn ein neues übergeben wurde
    let encryptedClientSecret;
    if (clientSecret && clientSecret !== '***HIDDEN***') {
      try {
        encryptedClientSecret = cryptoService.encrypt(clientSecret);
        console.log('🔒 SSO Client Secret verschlüsselt');
      } catch (error) {
        console.error('❌ Fehler beim Verschlüsseln des Client Secrets:', error);
        return res.status(500).json({ error: 'Fehler beim Verschlüsseln des Client Secrets' });
      }
    }

    // Check if config exists
    const existing = await pool.query('SELECT id FROM sso_config WHERE id = 1');

    let result;
    if (existing.rows.length === 0) {
      // Create new config
      result = await pool.query(
        `INSERT INTO sso_config
         (id, is_enabled, tenant_id, client_id, client_secret, redirect_uri, button_text, allowed_groups, frontend_url)
         VALUES (1, $1::boolean, $2::text, $3::text, $4::text, $5::text, $6::text, $7::jsonb, $8::text)
         RETURNING *`,
        [
          !!isEnabled,
          tenantId || '',
          clientId || '',
          encryptedClientSecret || '',
          redirectUri || '',
          buttonText || 'Mit Microsoft anmelden',
          JSON.stringify(Array.isArray(allowedGroups) ? allowedGroups : []),
          frontendUrl || ''
        ]
      );
    } else {
      // Update existing config. Feste Platzhalter + COALESCE für Secret.
      // Verwende verschlüsseltes Secret oder behalte das alte
      const clientSecretParam = encryptedClientSecret || null;

      const query = `
        UPDATE sso_config
        SET
          is_enabled    = $1::boolean,
          tenant_id     = $2::text,
          client_id     = $3::text,
          client_secret = COALESCE($4::text, client_secret),
          redirect_uri  = $5::text,
          button_text   = $6::text,
          allowed_groups= $7::jsonb,
          frontend_url  = $8::text
        WHERE id = 1
        RETURNING *;
      `;

      const params = [
        !!isEnabled,
        tenantId || '',
        clientId || '',
        clientSecretParam, // null => unverändert
        redirectUri || '',
        buttonText || 'Mit Microsoft anmelden',
        JSON.stringify(Array.isArray(allowedGroups) ? allowedGroups : []),
        frontendUrl || ''
      ];

      result = await pool.query(query, params);
    }

    res.json({
      message: 'SSO Konfiguration erfolgreich gespeichert',
      config: {
        isEnabled: result.rows[0].is_enabled,
        tenantId: result.rows[0].tenant_id,
        clientId: result.rows[0].client_id,
        redirectUri: result.rows[0].redirect_uri,
        buttonText: result.rows[0].button_text,
        allowedGroups: result.rows[0].allowed_groups,
        frontendUrl: result.rows[0].frontend_url
      }
    });
  } catch (error) {
    console.error('Update SSO config error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der SSO Konfiguration' });
  }
});

// Manual Sync Users (Admin only)
router.post('/sync', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const configResult = await pool.query('SELECT * FROM sso_config WHERE id = 1');

    if (configResult.rows.length === 0 || !configResult.rows[0].is_enabled) {
      return res.status(400).json({ error: 'SSO ist nicht konfiguriert oder deaktiviert' });
    }

    const config = configResult.rows[0];

    // 🔓 Entschlüssele das Client Secret
    let decryptedClientSecret;
    try {
      if (config.client_secret) {
        decryptedClientSecret = cryptoService.decrypt(config.client_secret);
        console.log('🔓 SSO Client Secret entschlüsselt');
      }
    } catch (error) {
      console.error('❌ Fehler beim Entschlüsseln des Client Secrets:', error.message);
      return res.status(500).json({
        error: 'Client Secret konnte nicht entschlüsselt werden',
        details: error.message
      });
    }

    // Get access token for Microsoft Graph
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: config.client_id,
        client_secret: decryptedClientSecret,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // === Fetch users ===
    let azureUsers = [];
    const headers = { Authorization: `Bearer ${accessToken}` };

    if (Array.isArray(config.allowed_groups) && config.allowed_groups.length > 0) {
      // Nur Mitglieder der konfigurierten Gruppen (transitiv)
      const ids = new Set();
      for (const groupId of config.allowed_groups) {
        // Nur Benutzer zurückgeben: Kastenavigation "microsoft.graph.user"
        let url =
          `https://graph.microsoft.com/v1.0/groups/${encodeURIComponent(groupId)}` +
          `/transitiveMembers/microsoft.graph.user?$select=id,userPrincipalName,displayName,mail`;
        // Paging beachten
        while (url) {
          const resp = await axios.get(url, { headers });
          for (const u of resp.data.value || []) {
            if (!ids.has(u.id)) {
              ids.add(u.id);
              azureUsers.push({
                id: u.id,
                userPrincipalName: u.userPrincipalName,
                displayName: u.displayName,
                mail: u.mail
              });
            }
          }
          url = resp.data['@odata.nextLink'] || null;
        }
      }
    } else {
      // Fallback: alle aktiven Benutzer
      let url = 'https://graph.microsoft.com/v1.0/users' +
                '?$select=id,userPrincipalName,displayName,mail,accountEnabled' +
                '&$filter=accountEnabled eq true';
      const list = [];
      while (url) {
        const r = await axios.get(url, { headers });
        list.push(...(r.data.value || []));
        url = r.data['@odata.nextLink'] || null;
      }
      azureUsers = list.map(u => ({
        id: u.id,
        userPrincipalName: u.userPrincipalName,
        displayName: u.displayName,
        mail: u.mail
      }));
    }
    let syncedCount = 0;
    let createdCount = 0;

    for (const azureUser of azureUsers) {
      try {
        const email = azureUser.mail || azureUser.userPrincipalName;
        if (!email) continue; // überspringe Objekte ohne identifizierende Mail

        // UPSERT nach (email, auth_type)
        const r = await pool.query(
          `INSERT INTO users (username, email, display_name, auth_type, is_admin, is_active, sso_id)
           VALUES ($1, $2, $3, 'sso', false, true, $4)
           ON CONFLICT (email, auth_type)
           DO UPDATE SET display_name = EXCLUDED.display_name, sso_id = EXCLUDED.sso_id
           RETURNING (xmax = 0) AS inserted`,
          [azureUser.userPrincipalName || email, email, azureUser.displayName || email, azureUser.id]
        );
        if (r.rows[0]?.inserted) createdCount++; else updatedCount++;
      } catch (e) {
        // zähle als Update bei Konflikt o.ä.
	  } finally { syncedCount++; }
    }
    // grobe Korrektur: angelegte minus vorhandene
    const updatedCount = Math.max(0, syncedCount - createdCount);

    // Update last sync time
    await pool.query(
      'UPDATE sso_config SET last_sync = CURRENT_TIMESTAMP WHERE id = 1'
    );

    return res.json({
      message: 'Benutzer erfolgreich synchronisiert',
      syncedCount,
      createdCount,
      updatedCount
    });
  } catch (error) {
    const status = error.response?.status || 500;
    const graphErr = error.response?.data?.error;
    console.error('Sync users error:', {
      status,
      code: graphErr?.code,
      message: graphErr?.message || error.message,
    });
    res.status(status).json({
      error: 'Fehler beim Synchronisieren der Benutzer',
      code: graphErr?.code || 'UNKNOWN',
      details: graphErr?.message || error.message,
    });
  }
});

// Get SSO Config for Login Page (Public)
router.get('/public', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT is_enabled, button_text, redirect_uri FROM sso_config WHERE id = 1'
    );

    if (result.rows.length === 0 || !result.rows[0].is_enabled) {
      return res.json({ enabled: false });
    }

    res.json({
      enabled: true,
      buttonText: result.rows[0].button_text,
      redirectUri: result.rows[0].redirect_uri
    });
  } catch (error) {
    console.error('Get public SSO config error:', error);
    res.json({ enabled: false });
  }
});

module.exports = router;
