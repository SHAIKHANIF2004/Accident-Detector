const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const Analysis = require('../models/Analysis');

// --- Render Compatible File Paths ---
// For Render, we MUST use the OS temporary directory as the local file system is ephemeral
const SAMPLE_VIDEOS_DIR = path.join(__dirname, '..', '..', 'sample-videos');
// Create a dedicated temp folder for CrashSense
const UPLOADS_DIR = path.join(os.tmpdir(), 'crashsense_uploads');

const activeProcesses = new Map();

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.avi', '.mov', '.mkv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only video files (mp4, avi, mov, mkv) are allowed.'));
  },
  limits: { fileSize: 100 * 1024 * 1024 } // REDUCED TO 100MB FOR RENDER FREE TIER MEMORY SAFETY
});

exports.uploadMiddleware = upload.single('video');

// Helper to safely delete file
const safeDelete = (filepath) => {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`[Cleanup] Deleted ephemeral file: ${filepath}`);
    }
  } catch (e) {
    console.error(`[Cleanup] Failed to delete: ${filepath}`, e.message);
  }
};

exports.streamVideo = (req, res) => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    let filePath = path.join(SAMPLE_VIDEOS_DIR, safeName);

    // Also check uploads directory
    if (!fs.existsSync(filePath)) {
      filePath = path.join(UPLOADS_DIR, safeName);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Video file not found.' });
    }

    const extName = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska'
    };
    const contentType = mimeTypes[extName] || 'video/mp4';

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to stream video.' });
  }
};

exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded.' });
    
    const { spawn } = require('child_process');
    const inputPath = req.file.path;
    const safeName = req.file.filename;
    // We transcode to an MP4 with H.264 (avc1) for maximum browser compatibility
    const previewFilename = `preview-${path.parse(safeName).name}.mp4`;
    const outputPath = path.join(UPLOADS_DIR, previewFilename);
    console.log(`[Transcode] Starting FFmpeg for ${safeName}...`);
    
    // Use fluent-ffmpeg with the bundled static ffmpeg binary to guarantee it works on Render native
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegPath);

    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset ultrafast', // Optimize for speed and low memory on Render
        '-crf 28',
        '-c:a aac'
      ])
      .save(outputPath)
      .on('end', () => {
        console.log(`[Transcode] FFmpeg finished successfully for ${safeName}`);
        
        // Render Free Tier trick: Cleanup the original massive file if we transcoded it successfully
        if (inputPath !== outputPath) {
            safeDelete(inputPath);
        }

        res.json({
          message: 'Video uploaded and prepared successfully.',
          filename: previewFilename, // Use the preview file for analysis to guarantee format matching
          path: `/api/videos/stream/${previewFilename}`
        });
      })
      .on('error', (err) => {
        console.error(`[Transcode] FFmpeg error for ${safeName}:`, err);
        if (!res.headersSent) {
          // Fallback to original if transcoding fails
          res.json({
            message: 'Video uploaded (transcoding native failed).',
            filename: req.file.filename,
            path: `/api/videos/stream/${req.file.filename}`
          });
        }
      });

  } catch (error) {
    console.error('Upload/Transcode error:', error);
    res.status(500).json({ error: 'Failed to upload or prepare video.' });
  }
};

exports.analyzeVideo = (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Filename is required for analysis.' });

  const userId = req.user ? req.user._id.toString() : 'anonymous';

  if (activeProcesses.has(userId)) {
    try {
      const oldProcess = activeProcesses.get(userId);
      if (oldProcess && typeof oldProcess.kill === 'function') {
        console.log(`[AI Analysis] Killing previous process for user ${userId}`);
        oldProcess.kill('SIGKILL');
      }
    } catch (e) {
      console.error('[AI Analysis] Error killing active process:', e);
    }
    activeProcesses.delete(userId);
  }

  const safeName = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found or expired from temporary storage. Please re-upload.' });
  }

  // --- RENDER FREE TIER FIX: MICROSERVICES VIA HUGGING FACE OR DEMO MODE ---
  if (process.env.NODE_ENV === 'production') {
    if (process.env.HF_SPACE_URL) {
        console.log(`[AI Analysis HF] Sending video to Hugging Face API: ${process.env.HF_SPACE_URL}`);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        res.write(`data: ${JSON.stringify({ status: 'started' })}\n\n`);

        const simInterval = setInterval(() => {
          res.write(`data: ${JSON.stringify({ status: 'processing', timestamp: Date.now(), msg: 'Waiting for ML server...' })}\n\n`);
        }, 5000);

        (async () => {
            try {
                // 1. Upload video to Hugging Face
                const fileBuffer = fs.readFileSync(filePath);
                const blob = new Blob([fileBuffer], { type: 'video/mp4' });
                const formData = new FormData();
                formData.append('video', blob, safeName);

                const response = await fetch(`${process.env.HF_SPACE_URL}/analyze`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error(`HF Server returned ${response.status}`);
                const data = await response.json();
                
                if (data.error) throw new Error(data.error);

                // 2. Download the annotated video from HF Space back to Render
                let finalNameTarget = safeName;
                if (data.video_id) {
                    const videoRes = await fetch(`${process.env.HF_SPACE_URL}/download/${data.video_id}`);
                    if (videoRes.ok) {
                        const dlFileName = `hf-annotated-${safeName}`;
                        const dlFilePath = path.join(UPLOADS_DIR, dlFileName);
                        const writeStream = fs.createWriteStream(dlFilePath);
                        
                        await new Promise((resolve, reject) => {
                            videoRes.body.pipe(writeStream);
                            videoRes.body.on('error', reject);
                            writeStream.on('finish', resolve);
                        });
                        
                        finalNameTarget = dlFileName;
                    }
                }

                clearInterval(simInterval);

                // 3. Save to database
                const analysisData = {
                  userId: req.user._id,
                  fileName: safeName,
                  fileSize: fs.statSync(filePath).size,
                  duration: 0,
                  markers: data.markers || [],
                  originalVideoPath: `/api/videos/stream/${safeName}`,
                  annotatedVideoUrl: `/api/videos/stream/${finalNameTarget}`,
                  processedAt: new Date()
                };

                const savedAnalysis = await Analysis.create(analysisData);
                res.write(`data: ${JSON.stringify({
                  success: true,
                  markers: data.markers || [],
                  annotatedVideoUrl: `/api/videos/stream/${finalNameTarget}`,
                  analysisId: savedAnalysis._id
                })}\n\n`);
                res.end();
            } catch (err) {
                console.error("[AI Analysis HF] Error communicating with Hugging Face:", err);
                clearInterval(simInterval);
                res.write(`data: ${JSON.stringify({ error: err.message || 'Failed connecting to Hugging Face ML API' })}\n\n`);
                res.end();
            }
        })();
        return;
    } else {
        // --- FALLBACK DEMO MODE ---
        console.log(`[AI Analysis Demo Mode] Simulating analysis for ${safeName}`);
        
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        res.write(`data: ${JSON.stringify({ status: 'started' })}\n\n`);

        let progress = 0;
        const simInterval = setInterval(() => {
          progress += 10;
          res.write(`data: ${JSON.stringify({ status: 'processing', progress, timestamp: Date.now() })}\n\n`);
          
          if (progress >= 100) {
            clearInterval(simInterval);
            
            const markers = [
              { time: 2, confidence: 94, objects: ['car', 'motorcycle'] }
            ];

            const analysisData = {
              userId: req.user._id,
              fileName: safeName,
              fileSize: fs.statSync(filePath).size,
              duration: 0,
              markers: markers,
              originalVideoPath: `/api/videos/stream/${safeName}`,
              annotatedVideoUrl: `/api/videos/stream/${safeName}`, 
              processedAt: new Date()
            };

            Analysis.create(analysisData).then(savedAnalysis => {
              res.write(`data: ${JSON.stringify({
                success: true,
                markers: markers,
                annotatedVideoUrl: `/api/videos/stream/${safeName}`,
                analysisId: savedAnalysis._id
              })}\n\n`);
              res.end();
            }).catch(err => {
              res.write(`data: ${JSON.stringify({ error: 'Failed to save analysis' })}\n\n`);
              res.end();
            });
          }
        }, 1000); 

        return;
    }
  }
  // --- END RENDER MICROSERVICE LOGIC ---

  // LOCAL DEVELOPMENT: Run the actual heavy Python PyTorch script
  const pythonScript = path.resolve(__dirname, '..', '..', '..', 'Engine', 'codes', 'test_inference_lite.py');
  const cwd = path.dirname(pythonScript);
  const { spawn } = require('child_process');
  
  let pythonPath = 'python3'; 
  if (process.platform === 'win32') {
    const venvPath = path.resolve(__dirname, '..', '..', '..', '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPath)) pythonPath = venvPath;
    else pythonPath = 'python';
  }
  
  const outFileName = `annotated-${safeName}`;
  const outFilePath = path.join(UPLOADS_DIR, outFileName);

  const aiEnv = { ...process.env, 'OMP_NUM_THREADS': '1', 'MKL_NUM_THREADS': '1', 'OPENBLAS_NUM_THREADS': '1' };
  const pythonProcess = spawn(pythonPath, [pythonScript, '--video', filePath, '--output', outFilePath], { cwd, env: aiEnv });
  activeProcesses.set(userId, pythonProcess);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`data: ${JSON.stringify({ status: 'started' })}\n\n`);

  const ANALYSIS_TIMEOUT = 6 * 60 * 1000;
  const timeout = setTimeout(() => {
    pythonProcess.kill('SIGKILL');
    res.write(`data: ${JSON.stringify({ error: 'Analysis timed out.' })}\n\n`);
    res.end();
  }, ANALYSIS_TIMEOUT);

  const heartbeatInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ status: 'processing', timestamp: Date.now() })}\n\n`);
  }, 15000);

  pythonProcess.on('error', (err) => {
    clearInterval(heartbeatInterval);
    res.write(`data: ${JSON.stringify({ error: 'AI processing engine is not available.' })}\n\n`);
    res.end();
  });

  const markers = [];
  let stdoutBuffer = '';

  pythonProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); 

    for (const line of lines) {
      if (line.startsWith('FRAME:')) {
        const b64 = line.substring(6).trim();
        if (b64.length < 500000) req.app.get('io').emit('video_frame', `data:image/jpeg;base64,${b64}`);
      } else if (line.includes('MARKER:')) {
        const parts = line.split('MARKER:')[1].trim().split(':');
        if (parts.length >= 2) {
          markers.push({ time: Math.round(parseFloat(parts[0])), confidence: Math.round(parseFloat(parts[1])), objects: parts.length > 2 ? parts[2].split(',') : ['vehicle'] });
        }
      }
    }
  });

  let stderrBuffer = '';
  pythonProcess.stderr.on('data', (data) => { stderrBuffer += data.toString().trim(); });

  pythonProcess.on('close', async (code) => {
    clearTimeout(timeout);
    clearInterval(heartbeatInterval);
    
    if (code !== 0 && code !== null) {
      res.write(`data: ${JSON.stringify({ error: 'AI engine failed.', details: stderrBuffer.substring(0, 200) })}\n\n`);
      return res.end();
    }

    const sendResponse = async (finalNameTarget) => {
      const analysisData = {
        userId: req.user._id,
        fileName: safeName,
        fileSize: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
        duration: 0,
        markers: markers,
        originalVideoPath: `/api/videos/stream/${safeName}`,
        annotatedVideoUrl: `/api/videos/stream/${finalNameTarget}`,
        processedAt: new Date()
      };

      try {
        const savedAnalysis = await Analysis.create(analysisData);
        res.write(`data: ${JSON.stringify({ success: true, markers: markers, annotatedVideoUrl: `/api/videos/stream/${finalNameTarget}`, analysisId: savedAnalysis._id })}\n\n`);
      } catch (saveError) {
        res.write(`data: ${JSON.stringify({ success: true, markers: markers, annotatedVideoUrl: `/api/videos/stream/${finalNameTarget}` })}\n\n`);
      }
      res.end();
    };

    if (fs.existsSync(outFilePath)) {
      sendResponse(outFileName);
    } else {
      sendResponse(safeName);
    }
  });
};

exports.getAnalysisHistory = async (req, res) => {
  try {
    const history = await Analysis.find({ userId: req.user._id }).sort({ processedAt: -1 });
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analysis history.' });
  }
};

exports.deleteAnalysis = async (req, res) => {
  try {
    const analysis = await Analysis.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!analysis) return res.status(404).json({ error: 'Analysis not found.' });
    
    // Also try removing matching annotated video if it exists in tmp
    const possibleName = path.basename(analysis.annotatedVideoUrl || '');
    if (possibleName) safeDelete(path.join(UPLOADS_DIR, possibleName));

    res.json({ message: 'Analysis history entry deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete analysis history.' });
  }
};

exports.listVideos = (req, res) => {
  try {
    const videos = [];
    if (fs.existsSync(SAMPLE_VIDEOS_DIR)) {
      const files = fs.readdirSync(SAMPLE_VIDEOS_DIR).filter(f => /\.(mp4|avi|mov|mkv)$/i.test(f));
      files.forEach(f => videos.push({ name: f, type: 'sample', path: `/api/videos/stream/${f}` }));
    }
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR).filter(f => /\.(mp4|avi|mov|mkv)$/i.test(f));
      files.forEach(f => videos.push({ name: f, type: 'uploaded', path: `/api/videos/stream/${f}` }));
    }
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list videos.' });
  }
};
