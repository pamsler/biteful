const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getActivityLogs, getRecentActivityLogs, cleanupOldLogs } = require('../services/activity-logger');

/**
 * GET /api/activity-logs
 * Holt alle Activity Logs mit Pagination und Filtern
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const filters = {};
    if (req.query.userId) filters.userId = parseInt(req.query.userId);
    if (req.query.actionType) filters.actionType = req.query.actionType;
    if (req.query.entityType) filters.entityType = req.query.entityType;

    const result = await getActivityLogs(limit, offset, filters);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Activity Logs' });
  }
});

/**
 * GET /api/activity-logs/recent
 * Holt die neuesten Activity Logs (für Popup)
 */
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const logs = await getRecentActivityLogs(limit);

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error fetching recent activity logs:', error);
    res.status(500).json({ error: 'Fehler beim Laden der neuesten Activity Logs' });
  }
});

/**
 * DELETE /api/activity-logs/cleanup
 * Löscht alte Activity Logs (nur für Admins)
 */
router.delete('/cleanup', authMiddleware, async (req, res) => {
  try {
    // Nur Admins dürfen Logs löschen
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const daysToKeep = parseInt(req.query.days) || 90;
    const deletedCount = await cleanupOldLogs(daysToKeep);

    res.json({
      success: true,
      message: `${deletedCount} alte Activity Logs gelöscht`,
      deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up activity logs:', error);
    res.status(500).json({ error: 'Fehler beim Löschen alter Activity Logs' });
  }
});

module.exports = router;
