const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', auth, getSettings);
router.put('/', auth, requireRole('Admin'), updateSettings);

module.exports = router;
