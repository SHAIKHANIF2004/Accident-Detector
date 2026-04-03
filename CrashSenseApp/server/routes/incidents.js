const express = require('express');
const router = express.Router();
const { getIncidents, getIncident, updateIncidentStatus, getDashboardStats, deleteIncident } = require('../controllers/incidentController');
const { auth, requireRole } = require('../middleware/auth');

router.get('/stats', auth, getDashboardStats);
router.get('/', auth, getIncidents);
router.get('/:id', auth, getIncident);
router.put('/:id/status', auth, updateIncidentStatus);
router.delete('/:id', auth, deleteIncident);

module.exports = router;
