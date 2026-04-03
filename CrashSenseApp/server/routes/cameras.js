const express = require('express');
const router = express.Router();
const { getCameras, getCamera, createCamera, updateCamera, deleteCamera } = require('../controllers/cameraController');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', auth, getCameras);
router.get('/:id', auth, getCamera);
router.post('/', auth, createCamera);
router.put('/:id', auth, updateCamera);
router.delete('/:id', auth, deleteCamera);

module.exports = router;
