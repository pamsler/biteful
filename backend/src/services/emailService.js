const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const cryptoService = require('./cryptoService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async getSmtpSettings() {
    const result = await pool.query('SELECT * FROM smtp_settings ORDER BY id DESC LIMIT 1');
    return result.rows[0];
  }

  async initializeTransporter() {
    const settings = await this.getSmtpSettings();

    if (!settings || !settings.enabled) {
      return null;
    }

    // 🔓 Entschlüssele das SMTP-Passwort
    let decryptedPassword;
    try {
      if (settings.smtp_password) {
        decryptedPassword = cryptoService.decrypt(settings.smtp_password);
        console.log('🔓 SMTP-Passwort entschlüsselt');
      }
    } catch (error) {
      console.error('❌ Fehler beim Entschlüsseln des SMTP-Passworts:', error.message);
      throw new Error('SMTP-Passwort konnte nicht entschlüsselt werden');
    }

    this.transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure,
      auth: {
        user: settings.smtp_user,
        pass: decryptedPassword,
      },
    });

    return this.transporter;
  }

  async sendEmail(to, subject, html) {
    try {
      const transporter = await this.initializeTransporter();

      if (!transporter) {
        throw new Error('SMTP nicht konfiguriert oder deaktiviert');
      }

      const settings = await this.getSmtpSettings();

      const info = await transporter.sendMail({
        from: `"${settings.sender_name}" <${settings.sender_email}>`,
        to,
        subject,
        html,
      });

      console.log('✅ Email gesendet:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Email-Fehler:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const transporter = await this.initializeTransporter();

      if (!transporter) {
        throw new Error('SMTP nicht konfiguriert');
      }

      await transporter.verify();
      return { success: true, message: 'SMTP-Verbindung erfolgreich' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async sendTestEmail(email) {
    try {
      const settings = await this.getSmtpSettings();

      if (!settings || !settings.enabled) {
        throw new Error('SMTP nicht konfiguriert oder deaktiviert');
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Test Email</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); border-radius: 16px 16px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">
                        ✅ Test Email
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px;">
                        Herzlichen Glückwunsch!
                      </h2>
                      <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                        Deine SMTP-Konfiguration funktioniert einwandfrei. Diese Test-Email wurde erfolgreich über deinen konfigurierten SMTP-Server gesendet.
                      </p>

                      <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                        <tr>
                          <td style="padding: 20px; background-color: #eff6ff; border-radius: 12px; border-left: 4px solid #3b82f6;">
                            <p style="margin: 0 0 10px; color: #1e40af; font-weight: bold; font-size: 14px;">
                              📧 Server-Informationen
                            </p>
                            <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                              <strong>Host:</strong> ${settings.smtp_host}<br>
                              <strong>Port:</strong> ${settings.smtp_port}<br>
                              <strong>Absender:</strong> ${settings.sender_name} &lt;${settings.sender_email}&gt;<br>
                              <strong>Verschlüsselung:</strong> ${settings.smtp_secure ? 'SSL/TLS (Port 465)' : 'STARTTLS (Port 587)'}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                        Du kannst nun automatische Email-Benachrichtigungen für deinen Biteful nutzen:
                      </p>

                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 15px; background-color: #f0fdf4; border-radius: 8px; margin-bottom: 10px;">
                            <p style="margin: 0; color: #166534; font-size: 14px;">
                              <strong>📅 Täglicher Menüplan</strong><br>
                              Jeden Tag um 07:00 Uhr (Schweizer Zeit)
                            </p>
                          </td>
                        </tr>
                        <tr><td style="height: 10px;"></td></tr>
                        <tr>
                          <td style="padding: 15px; background-color: #fef3c7; border-radius: 8px;">
                            <p style="margin: 0; color: #92400e; font-size: 14px;">
                              <strong>⏰ Wöchentliche Erinnerung</strong><br>
                              Jeden Sonntag um 10:00 Uhr (Schweizer Zeit)
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; text-align: center; background-color: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; color: #6b7280; font-size: 14px;">
                        🍴 Biteful<br>
                        <span style="font-size: 12px;">Diese Email wurde um ${new Date().toLocaleString('de-CH', { dateStyle: 'full', timeStyle: 'short' })} gesendet</span>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await this.sendEmail(email, '✅ Test Email - Biteful SMTP', html);
      return { success: true, message: `Test-Email erfolgreich an ${email} gesendet` };
    } catch (error) {
      console.error('❌ Fehler beim Senden der Test-Email:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();
