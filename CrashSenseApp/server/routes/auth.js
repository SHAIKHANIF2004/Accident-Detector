const express = require('express');
const router = express.Router();
const { login, register, getMe, getUsers } = require('../controllers/authController');
const { auth, requireRole } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.get('/me', auth, getMe);
router.get('/users', auth, requireRole('Admin'), getUsers);

module.exports = router;
