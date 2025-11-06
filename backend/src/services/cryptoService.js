const crypto = require('crypto');

/**
 * 🔒 CRYPTO SERVICE - AES-256-GCM Verschlüsselung
 *
 * Verschlüsselt kritische Daten in der Datenbank:
 * - SMTP-Passwörter
 * - SSO Client Secrets
 * - Andere sensible Credentials
 *
 * Verwendet AES-256-GCM (Authenticated Encryption)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES block size
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

class CryptoService {
  constructor() {
    this.encryptionKey = null;
    this.initializeKey();
  }

  /**
   * Initialisiert den Encryption Key aus Environment Variable
   */
  initializeKey() {
    const keyString = process.env.ENCRYPTION_KEY;

    if (!keyString) {
      console.error('❌ KRITISCH: ENCRYPTION_KEY nicht gesetzt!');
      console.error('   Bitte setze ENCRYPTION_KEY in docker-compose.yml');
      console.error('   Generiere einen Key mit: openssl rand -hex 32');
      throw new Error('ENCRYPTION_KEY fehlt in Environment');
    }

    // Key muss 32 Bytes (64 hex chars) für AES-256 sein
    if (keyString.length !== 64) {
      throw new Error('ENCRYPTION_KEY muss 64 Hex-Zeichen lang sein (32 Bytes)');
    }

    this.encryptionKey = Buffer.from(keyString, 'hex');
    console.log('🔒 Crypto Service initialisiert (AES-256-GCM)');
  }

  /**
   * Verschlüsselt einen String
   *
   * @param {string} plaintext - Klartext zum Verschlüsseln
   * @returns {string} Verschlüsselter String im Format: iv:authTag:encrypted
   */
  encrypt(plaintext) {
    if (!plaintext) {
      return null;
    }

    try {
      // Generiere zufälligen IV (Initialization Vector)
      const iv = crypto.randomBytes(IV_LENGTH);

      // Erstelle Cipher mit Key und IV
      const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

      // Verschlüssele den Text
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Hole Authentication Tag (verhindert Manipulation)
      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:encrypted (alle als hex)
      const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

      return result;
    } catch (error) {
      console.error('❌ Encryption error:', error);
      throw new Error('Verschlüsselung fehlgeschlagen');
    }
  }

  /**
   * Entschlüsselt einen String
   *
   * @param {string} encryptedData - Verschlüsselter String im Format: iv:authTag:encrypted
   * @returns {string} Entschlüsselter Klartext
   */
  decrypt(encryptedData) {
    if (!encryptedData) {
      return null;
    }

    try {
      // Parse das Format: iv:authTag:encrypted
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Ungültiges verschlüsseltes Daten-Format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      // Erstelle Decipher mit Key und IV
      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);

      // Setze Authentication Tag für Validierung
      decipher.setAuthTag(authTag);

      // Entschlüssele den Text
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('❌ Decryption error:', error.message);
      throw new Error('Entschlüsselung fehlgeschlagen - möglicherweise falscher Key oder manipulierte Daten');
    }
  }

  /**
   * Prüft ob ein String verschlüsselt ist (anhand des Formats)
   *
   * @param {string} data - String zum Prüfen
   * @returns {boolean} true wenn verschlüsselt, false sonst
   */
  isEncrypted(data) {
    if (!data || typeof data !== 'string') {
      return false;
    }

    // Verschlüsselte Daten haben das Format: iv:authTag:encrypted
    const parts = data.split(':');
    if (parts.length !== 3) {
      return false;
    }

    // Prüfe ob alle Teile Hex sind
    const hexRegex = /^[0-9a-f]+$/i;
    return parts.every(part => hexRegex.test(part));
  }

  /**
   * Generiert einen neuen Encryption Key (für Initialisierung)
   *
   * @returns {string} 64 Hex-Zeichen (32 Bytes)
   */
  static generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }
}

// Singleton-Instanz
let instance = null;

try {
  instance = new CryptoService();
} catch (error) {
  console.error('❌ Crypto Service konnte nicht initialisiert werden:', error.message);
  // Wir werfen nicht, damit der Server starten kann (für Migration)
}

module.exports = instance;
