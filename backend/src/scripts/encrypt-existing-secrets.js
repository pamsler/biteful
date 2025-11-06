#!/usr/bin/env node

/**
 * 🔒 MIGRATION SCRIPT: Encrypt Existing Secrets
 *
 * Verschlüsselt alle existierenden Plaintext-Secrets in der Datenbank:
 * - SMTP Passwörter (smtp_settings.smtp_password)
 * - SSO Client Secrets (sso_config.client_secret)
 *
 * WICHTIG: Vor dem Ausführen sicherstellen, dass ENCRYPTION_KEY gesetzt ist!
 *
 * Usage: node encrypt-existing-secrets.js
 */

const { Pool } = require('pg');
const cryptoService = require('../services/cryptoService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function encryptSmtpPasswords() {
  console.log('\n🔍 Überprüfe SMTP Passwörter...');

  try {
    // Hole alle SMTP Settings
    const result = await pool.query('SELECT id, smtp_password FROM smtp_settings WHERE smtp_password IS NOT NULL AND smtp_password != \'\'');

    if (result.rows.length === 0) {
      console.log('   ✅ Keine SMTP Passwörter gefunden');
      return 0;
    }

    let encryptedCount = 0;
    let skippedCount = 0;

    for (const row of result.rows) {
      // Prüfe ob bereits verschlüsselt (Format: iv:authTag:encrypted)
      if (cryptoService.isEncrypted(row.smtp_password)) {
        console.log(`   ⏭️  SMTP ID ${row.id}: Bereits verschlüsselt, überspringe`);
        skippedCount++;
        continue;
      }

      // Verschlüssele das Passwort
      const encrypted = cryptoService.encrypt(row.smtp_password);

      // Update in DB
      await pool.query(
        'UPDATE smtp_settings SET smtp_password = $1 WHERE id = $2',
        [encrypted, row.id]
      );

      console.log(`   🔒 SMTP ID ${row.id}: Passwort verschlüsselt`);
      encryptedCount++;
    }

    console.log(`   ✅ SMTP: ${encryptedCount} verschlüsselt, ${skippedCount} übersprungen`);
    return encryptedCount;
  } catch (error) {
    console.error('   ❌ Fehler beim Verschlüsseln der SMTP Passwörter:', error.message);
    throw error;
  }
}

async function encryptSsoClientSecrets() {
  console.log('\n🔍 Überprüfe SSO Client Secrets...');

  try {
    // Hole alle SSO Configs
    const result = await pool.query('SELECT id, client_secret FROM sso_config WHERE client_secret IS NOT NULL AND client_secret != \'\'');

    if (result.rows.length === 0) {
      console.log('   ✅ Keine SSO Client Secrets gefunden');
      return 0;
    }

    let encryptedCount = 0;
    let skippedCount = 0;

    for (const row of result.rows) {
      // Prüfe ob bereits verschlüsselt
      if (cryptoService.isEncrypted(row.client_secret)) {
        console.log(`   ⏭️  SSO ID ${row.id}: Bereits verschlüsselt, überspringe`);
        skippedCount++;
        continue;
      }

      // Verschlüssele das Secret
      const encrypted = cryptoService.encrypt(row.client_secret);

      // Update in DB
      await pool.query(
        'UPDATE sso_config SET client_secret = $1 WHERE id = $2',
        [encrypted, row.id]
      );

      console.log(`   🔒 SSO ID ${row.id}: Client Secret verschlüsselt`);
      encryptedCount++;
    }

    console.log(`   ✅ SSO: ${encryptedCount} verschlüsselt, ${skippedCount} übersprungen`);
    return encryptedCount;
  } catch (error) {
    console.error('   ❌ Fehler beim Verschlüsseln der SSO Client Secrets:', error.message);
    throw error;
  }
}

async function main() {
  console.log('========================================');
  console.log('🔒 MIGRATION: Encrypt Existing Secrets');
  console.log('========================================');

  // Prüfe ob ENCRYPTION_KEY gesetzt ist
  if (!process.env.ENCRYPTION_KEY) {
    console.error('\n❌ FEHLER: ENCRYPTION_KEY nicht gesetzt!');
    console.error('   Bitte setze die Environment Variable ENCRYPTION_KEY');
    console.error('   Generiere einen Key mit: openssl rand -hex 32');
    process.exit(1);
  }

  console.log('\n✅ ENCRYPTION_KEY gefunden');
  console.log(`   Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Test DB Connection
    await pool.query('SELECT 1');
    console.log('✅ Datenbankverbindung erfolgreich');

    let totalEncrypted = 0;

    // Verschlüssele SMTP Passwörter
    totalEncrypted += await encryptSmtpPasswords();

    // Verschlüssele SSO Client Secrets
    totalEncrypted += await encryptSsoClientSecrets();

    console.log('\n========================================');
    console.log(`✅ Migration abgeschlossen!`);
    console.log(`   ${totalEncrypted} Secrets verschlüsselt`);
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ MIGRATION FEHLGESCHLAGEN:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
main();
