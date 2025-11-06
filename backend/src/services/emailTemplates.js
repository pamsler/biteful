// Outlook-kompatible Email Templates (Table-based layout)

function getDailyMenuTemplate(meals, date) {
  const formattedDate = new Date(date).toLocaleDateString('de-CH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mealTypes = ['Frühstück', 'Mittagessen', 'Abendessen'];
  const icons = { 'Frühstück': '🍳', 'Mittagessen': '🍽️', 'Abendessen': '🌙' };
  const colors = { 'Frühstück': '#F59E0B', 'Mittagessen': '#3B82F6', 'Abendessen': '#8B5CF6' };

  let mealRows = '';

  mealTypes.forEach(type => {
    const meal = meals.find(m => m.meal_type === type);
    if (meal) {
      mealRows += `
        <tr>
          <td style="padding: 15px; border-bottom: 1px solid #E5E7EB;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color: ${colors[type]}; color: white; padding: 8px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; display: inline-block;">
                  ${icons[type]} ${type}
                </td>
              </tr>
              <tr>
                <td style="padding-top: 10px;">
                  <h3 style="margin: 0; color: #1F2937; font-size: 18px;">${meal.meal_name}</h3>
                  ${meal.description ? `<p style="margin: 5px 0 0 0; color: #6B7280; font-size: 14px;">${meal.description}</p>` : ''}
                  ${meal.ingredients ? `<p style="margin: 10px 0 0 0; color: #9CA3AF; font-size: 13px; font-style: italic;">Zutaten: ${meal.ingredients}</p>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }
  });

  if (!mealRows) {
    mealRows = `
      <tr>
        <td style="padding: 30px; text-align: center; color: #9CA3AF;">
          <p>Für heute sind noch keine Mahlzeiten geplant.</p>
        </td>
      </tr>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #F3F4F6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F3F4F6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px;">🍴 Heutiger Menüplan</h1>
              <p style="margin: 10px 0 0 0; color: #E0E7FF; font-size: 16px;">${formattedDate}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${mealRows}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; color: #6B7280; font-size: 13px;">
                Diese Email wurde automatisch vom Biteful gesendet
              </p>
              <p style="margin: 5px 0 0 0; color: #9CA3AF; font-size: 12px;">
                Guten Appetit! 🌟
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
}

function getWeeklyReminderTemplate(weekNumber, year) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #F3F4F6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F3F4F6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px;">⏰ Wochenplanung Erinnerung</h1>
              <p style="margin: 10px 0 0 0; color: #FEF3C7; font-size: 16px;">KW ${weekNumber} • ${year}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1F2937; font-size: 22px;">📝 Zeit für die Wochenplanung!</h2>

              <p style="margin: 0 0 15px 0; color: #4B5563; font-size: 16px; line-height: 1.6;">
                Hallo! 👋
              </p>

              <p style="margin: 0 0 15px 0; color: #4B5563; font-size: 16px; line-height: 1.6;">
                Für die kommende Woche (<strong>KW ${weekNumber}</strong>) wurden noch keine Mahlzeiten geplant.
              </p>

              <p style="margin: 0 0 25px 0; color: #4B5563; font-size: 16px; line-height: 1.6;">
                Nimm dir ein paar Minuten Zeit, um deine Woche zu planen und gesunde Mahlzeiten vorzubereiten! 🍽️
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.5;">
                      💡 <strong>Tipp:</strong> Eine gute Wochenplanung spart Zeit, Geld und reduziert Lebensmittelverschwendung!
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0 0 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:8570'}" style="display: inline-block; background-color: #6366F1; color: #FFFFFF; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                      🍴 Jetzt planen
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; color: #6B7280; font-size: 13px;">
                Diese Erinnerung wurde automatisch vom Biteful gesendet
              </p>
              <p style="margin: 5px 0 0 0; color: #9CA3AF; font-size: 12px;">
                Jeden Sonntag um 10:00 Uhr (Schweizer Zeit) 🇨🇭
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
}

module.exports = {
  getDailyMenuTemplate,
  getWeeklyReminderTemplate
};
