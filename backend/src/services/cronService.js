const cron = require('node-cron');
const { Pool } = require('pg');
const emailService = require('./emailService');
const { getDailyMenuTemplate, getWeeklyReminderTemplate } = require('./emailTemplates');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

class CronService {
  constructor() {
    this.jobs = [];
  }

  async getSsoUsers() {
    const result = await pool.query(
      "SELECT email, display_name FROM users WHERE auth_type = 'sso' AND is_active = true"
    );
    return result.rows;
  }

  async getTodaysMeals() {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const today = days[new Date().getDay()];

    const now = new Date();
    const weekNumber = this.getWeekNumber(now);
    const year = now.getFullYear();

    const result = await pool.query(
      `SELECT m.*, u.username as created_by_name
       FROM meals m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.day_of_week = $1 AND m.week_number = $2 AND m.year = $3
       ORDER BY
         CASE m.meal_type
           WHEN 'Frühstück' THEN 1
           WHEN 'Mittagessen' THEN 2
           WHEN 'Abendessen' THEN 3
         END`,
      [today, weekNumber, year]
    );

    return result.rows;
  }

  async checkWeekHasMeals(weekNumber, year) {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM meals WHERE week_number = $1 AND year = $2',
      [weekNumber, year]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  async sendDailyMenu() {
    try {
      const settings = await emailService.getSmtpSettings();

      if (!settings || !settings.enabled || !settings.daily_menu_enabled) {
        console.log('⏭️  Täglicher Menüplan deaktiviert');
        return;
      }

      const users = await this.getSsoUsers();
      const meals = await this.getTodaysMeals();

      if (meals.length === 0) {
        console.log('📭 Keine Mahlzeiten für heute geplant - keine Email gesendet');
        return;
      }

      const html = getDailyMenuTemplate(meals, new Date());
      const subject = `🍴 Heutiger Menüplan - ${new Date().toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: 'long' })}`;

      for (const user of users) {
        try {
          await emailService.sendEmail(user.email, subject, html);
          console.log(`✅ Täglicher Menüplan gesendet an: ${user.email}`);
        } catch (error) {
          console.error(`❌ Fehler beim Senden an ${user.email}:`, error.message);
        }
      }

      console.log(`📧 Täglicher Menüplan an ${users.length} Benutzer gesendet`);
    } catch (error) {
      console.error('❌ Fehler beim Senden des täglichen Menüplans:', error);
    }
  }

  async sendWeeklyReminder() {
    try {
      const settings = await emailService.getSmtpSettings();

      if (!settings || !settings.enabled || !settings.weekly_reminder_enabled) {
        console.log('⏭️  Wöchentliche Erinnerung deaktiviert');
        return;
      }

      const now = new Date();
      // Nächste Woche
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const weekNumber = this.getWeekNumber(nextWeek);
      const year = nextWeek.getFullYear();

      // Prüfe ob bereits Mahlzeiten geplant sind
      const hasMeals = await this.checkWeekHasMeals(weekNumber, year);

      if (hasMeals) {
        console.log(`✅ KW ${weekNumber} ist bereits geplant - keine Erinnerung gesendet`);
        return;
      }

      const users = await this.getSsoUsers();
      const html = getWeeklyReminderTemplate(weekNumber, year);
      const subject = `⏰ Wochenplanung Erinnerung - KW ${weekNumber}`;

      for (const user of users) {
        try {
          await emailService.sendEmail(user.email, subject, html);
          console.log(`✅ Wöchentliche Erinnerung gesendet an: ${user.email}`);
        } catch (error) {
          console.error(`❌ Fehler beim Senden an ${user.email}:`, error.message);
        }
      }

      console.log(`📧 Wöchentliche Erinnerung an ${users.length} Benutzer gesendet`);
    } catch (error) {
      console.error('❌ Fehler beim Senden der wöchentlichen Erinnerung:', error);
    }
  }

  start() {
    console.log('🕒 Cron Service gestartet');

    // Täglicher Menüplan: Jeden Tag um 7:00 Uhr Schweizer Zeit (CET/CEST)
    // Europe/Zurich berücksichtigt automatisch Sommerzeit
    const dailyJob = cron.schedule(
      '0 7 * * *',
      () => {
        console.log('📧 Sende täglichen Menüplan...');
        this.sendDailyMenu();
      },
      {
        scheduled: true,
        timezone: 'Europe/Zurich'
      }
    );

    // Wöchentliche Erinnerung: Jeden Sonntag um 10:00 Uhr Schweizer Zeit
    const weeklyJob = cron.schedule(
      '0 10 * * 0',
      () => {
        console.log('📧 Sende wöchentliche Erinnerung...');
        this.sendWeeklyReminder();
      },
      {
        scheduled: true,
        timezone: 'Europe/Zurich'
      }
    );

    this.jobs.push(dailyJob, weeklyJob);

    console.log('✅ Cron Jobs eingerichtet:');
    console.log('   📧 Täglicher Menüplan: 07:00 Uhr (CET/CEST)');
    console.log('   ⏰ Wöchentliche Erinnerung: Sonntag 10:00 Uhr (CET/CEST)');
  }

  stop() {
    this.jobs.forEach(job => job.stop());
    console.log('🛑 Cron Service gestoppt');
  }
}

module.exports = new CronService();
