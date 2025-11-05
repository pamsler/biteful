const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Activity Logger Service
 * Protokolliert alle Benutzeraktionen für Nachvollziehbarkeit
 */

/**
 * Loggt eine Benutzeraktion
 * @param {Object} params - Log-Parameter
 * @param {number} params.userId - ID des Benutzers
 * @param {string} params.username - Benutzername
 * @param {string} params.actionType - Typ der Aktion (z.B. 'SHOPPING_ADD', 'MEAL_UPDATE')
 * @param {string} params.actionDescription - Beschreibung der Aktion
 * @param {string} params.entityType - Typ der betroffenen Entität (z.B. 'shopping_item', 'meal')
 * @param {number} params.entityId - ID der betroffenen Entität
 * @param {Object} params.metadata - Zusätzliche Metadaten
 */
async function logActivity({
  userId,
  username,
  actionType,
  actionDescription,
  entityType = null,
  entityId = null,
  metadata = null
}) {
  try {
    await pool.query(
      `INSERT INTO activity_logs
       (user_id, username, action_type, action_description, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, username, actionType, actionDescription, entityType, entityId, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (error) {
    console.error('❌ Error logging activity:', error);
    // Fehler beim Logging sollten die Hauptfunktion nicht blockieren
  }
}

/**
 * Holt alle Activity Logs mit Pagination
 */
async function getActivityLogs(limit = 50, offset = 0, filters = {}) {
  try {
    let query = `
      SELECT
        al.*,
        u.display_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filter nach Benutzer
    if (filters.userId) {
      query += ` AND al.user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    // Filter nach Action Type
    if (filters.actionType) {
      query += ` AND al.action_type = $${paramIndex}`;
      params.push(filters.actionType);
      paramIndex++;
    }

    // Filter nach Entity Type
    if (filters.entityType) {
      query += ` AND al.entity_type = $${paramIndex}`;
      params.push(filters.entityType);
      paramIndex++;
    }

    // Sortierung und Pagination
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Zähle Gesamtanzahl für Pagination
    let countQuery = `
      SELECT COUNT(*)
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const countParams = [];
    let countParamIndex = 1;

    if (filters.userId) {
      countQuery += ` AND al.user_id = $${countParamIndex}`;
      countParams.push(filters.userId);
      countParamIndex++;
    }
    if (filters.actionType) {
      countQuery += ` AND al.action_type = $${countParamIndex}`;
      countParams.push(filters.actionType);
      countParamIndex++;
    }
    if (filters.entityType) {
      countQuery += ` AND al.entity_type = $${countParamIndex}`;
      countParams.push(filters.entityType);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return {
      logs: result.rows,
      total,
      limit,
      offset
    };
  } catch (error) {
    console.error('❌ Error fetching activity logs:', error);
    throw error;
  }
}

/**
 * Holt die neuesten Activity Logs (für Popup)
 */
async function getRecentActivityLogs(limit = 10) {
  try {
    const result = await pool.query(
      `SELECT
        al.*,
        u.display_name
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching recent activity logs:', error);
    throw error;
  }
}

/**
 * Löscht alte Activity Logs (Cleanup)
 * @param {number} daysToKeep - Anzahl der Tage, die behalten werden sollen
 */
async function cleanupOldLogs(daysToKeep = 90) {
  try {
    const result = await pool.query(
      `DELETE FROM activity_logs
       WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
       RETURNING id`
    );
    console.log(`✅ Cleaned up ${result.rowCount} old activity logs`);
    return result.rowCount;
  } catch (error) {
    console.error('❌ Error cleaning up activity logs:', error);
    throw error;
  }
}

module.exports = {
  logActivity,
  getActivityLogs,
  getRecentActivityLogs,
  cleanupOldLogs
};
