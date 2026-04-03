const express = require('express');
const router = express.Router();
const { streamVideo, uploadVideo, uploadMiddleware, listVideos, analyzeVideo, getAnalysisHistory, deleteAnalysis } = require('../controllers/videoController');
const { auth } = require('../middleware/auth');

router.get('/stream/:filename', streamVideo);
router.get('/list', auth, listVideos);
router.post('/upload', auth, uploadMiddleware, uploadVideo);
router.post('/analyze', auth, analyzeVideo);
router.get('/history', auth, getAnalysisHistory);
router.delete('/history/:id', auth, deleteAnalysis);

module.exports = router;
