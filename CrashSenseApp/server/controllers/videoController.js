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
    const oldProcess = activeProcesses.get(userId);
    try {
      console.log(`[AI Analysis] Killing previous process for user ${userId}`);
      oldProcess.kill('SIGKILL');
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

  // Path to the main Engine inference script
  // In Docker, /app/Engine/codes/test_inference_lite.py
  const pythonScript = path.resolve(__dirname, '..', '..', '..', 'Engine', 'codes', 'test_inference_lite.py');
  
  // We need to run it in the Engine/codes directory so it finds models/yolo weights correctly
  const cwd = path.dirname(pythonScript);
  
  const { spawn } = require('child_process');
  
  // RENDER DOCKER FIX: Use global `python3` since we pip installed into system python in Docker
  let pythonPath = 'python3'; 
  
  if (process.platform === 'win32') {
    const venvPath = path.resolve(__dirname, '..', '..', '..', '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPath)) {
      pythonPath = venvPath;
      console.log(`[AI Analysis] Using Local Windows Virtual Environment Python: ${pythonPath}`);
    } else {
        pythonPath = 'python';
    }
  }
  
  // Create an output path for the annotated video
  const outFileName = `annotated-${safeName}`;
  const outFilePath = path.join(UPLOADS_DIR, outFileName);

  console.log(`[AI Analysis] Spawning ${pythonPath} ${pythonScript}`);
  console.log(`[AI Path Info] CWD: ${cwd}`);
  console.log(`[AI Path Info] Video: ${filePath}`);
  console.log(`[AI Path Info] Output: ${outFilePath}`);

  // Set memory limit environment variables explicitly for the child process so ONNX doesn't crash Render
  const aiEnv = {
      ...process.env,
      'OMP_NUM_THREADS': '1',
      'MKL_NUM_THREADS': '1',
      'OPENBLAS_NUM_THREADS': '1'
  };

  const pythonProcess = spawn(pythonPath, [pythonScript, '--video', filePath, '--output', outFilePath], { cwd, env: aiEnv });
  
  activeProcesses.set(userId, pythonProcess);

  // --- CRITICAL FIX FOR RENDER 504 TIMEOUT ---
  // We use Server-Sent Events (SSE) to keep the connection alive
  // Render kills any HTTP request that is silent for 100 seconds.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`data: ${JSON.stringify({ status: 'started' })}\n\n`);

  // Kill the process after 6 minutes (Render free tier timeout ceiling protection)
  const ANALYSIS_TIMEOUT = 6 * 60 * 1000;
  const timeout = setTimeout(() => {
    console.error(`[AI Analysis] Timeout after ${ANALYSIS_TIMEOUT / 1000}s, killing process`);
    pythonProcess.kill('SIGKILL');
    res.write(`data: ${JSON.stringify({ error: 'Analysis timed out due to Free Tier limits. Try a shorter video (< 10s).' })}\n\n`);
    res.end();
  }, ANALYSIS_TIMEOUT);

  // Send a heartbeat every 15 seconds to keep the connection active
  const heartbeatInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ status: 'processing', timestamp: Date.now() })}\n\n`);
  }, 15000);

  pythonProcess.on('error', (err) => {
    console.error(`[AI Error] Spawn error (Is Python installed?):`, err);
    clearInterval(heartbeatInterval);
    res.write(`data: ${JSON.stringify({ error: 'AI processing engine is not available or failed to start.' })}\n\n`);
    res.end();
  });

  const markers = [];
  let stdoutBuffer = '';

  pythonProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); // Keep the incomplete line for the next chunk

    for (const line of lines) {
      if (line.startsWith('FRAME:')) {
        const b64 = line.substring(6).trim();
        // Only emit if the base64 data is reasonable size (< 500KB)
        if (b64.length < 500000) {
          req.app.get('io').emit('video_frame', `data:image/jpeg;base64,${b64}`);
        }
      } else if (line.includes('MARKER:')) {
        const parts = line.split('MARKER:')[1].trim().split(':');
        if (parts.length >= 2) {
          markers.push({
            time: Math.round(parseFloat(parts[0])),
            confidence: Math.round(parseFloat(parts[1])),
            objects: parts.length > 2 ? parts[2].split(',') : ['vehicle']
          });
        }
      } else if (line.trim().length > 0) {
        console.log(`[AI] ${line.trim()}`);
      }
    }
  });

  let stderrBuffer = '';
  pythonProcess.stderr.on('data', (data) => {
    const errorMsg = data.toString().trim();
    stderrBuffer += errorMsg;
    // Log stderr for debugging but don't crash stream yet
    if (errorMsg.includes('Error') || errorMsg.includes('Exception') || errorMsg.includes('Killed')) {
         console.error(`[AI Python Error] ${errorMsg}`);
    } else {
         console.log(`[AI Python Log] ${errorMsg}`); // Some libs log info to stderr
    }
  });

  pythonProcess.on('close', async (code) => {
    // We keep heartbeatInterval running during the next ffmpeg transcode block
    clearTimeout(timeout);
    if (activeProcesses.get(userId) === pythonProcess) {
      activeProcesses.delete(userId);
    }
    console.log(`[AI Analysis] Finished with exit code ${code}`);
    
    // Check if process was killed due to memory limit (Exit code 137 typically)
    if (code === 137) {
        clearInterval(heartbeatInterval);
        console.error(`[AI Analysis] Process killed by OS (Likely OUT OF MEMORY on Render 512MB RAM limit).`);
        res.write(`data: ${JSON.stringify({ 
          error: 'Out of Memory Error on Render Server. The Free Tier 512MB limit was exceeded. Try a lower resolution or shorter video.'
        })}\n\n`);
        res.end();
        return;
    }

    if (code !== 0 && code !== null) {
      clearInterval(heartbeatInterval);
      console.error(`[AI Analysis] Failed with code ${code}. Stderr: ${stderrBuffer.substring(0, 500)}`);
      res.write(`data: ${JSON.stringify({ 
        error: 'AI processing engine failed to complete the analysis successfully.',
        details: stderrBuffer.substring(0, 200) + '...' 
      })}\n\n`);
      res.end();
      return;
    }

    // Re-encode annotated video with ffmpeg for browser compatibility (mp4v -> H.264)
    let finalVideoName = outFileName;
    const browserReadyName = `web-${outFileName}`;
    const browserReadyPath = path.join(UPLOADS_DIR, browserReadyName);

    const sendResponse = async (finalNameTarget) => {
      clearInterval(heartbeatInterval);
      const analysisData = {
        userId: req.user._id,
        fileName: safeName,
        fileSize: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
        duration: 0,
        markers: markers,
        originalVideoPath: `/api/videos/stream/${safeName}`, // Might 404 later depending on cleanup config but saves state
        annotatedVideoUrl: `/api/videos/stream/${finalNameTarget}`,
        processedAt: new Date()
      };

      try {
        const savedAnalysis = await Analysis.create(analysisData);
        res.write(`data: ${JSON.stringify({
          success: true,
          markers: markers,
          annotatedVideoUrl: `/api/videos/stream/${finalNameTarget}`,
          analysisId: savedAnalysis._id
        })}\n\n`);
      } catch (saveError) {
        console.error('Failed to save analysis results:', saveError);
        res.write(`data: ${JSON.stringify({
          success: true,
          markers: markers,
          annotatedVideoUrl: `/api/videos/stream/${finalNameTarget}`
        })}\n\n`);
      }
      res.end();
      
      // Cleanup ephemeral files slightly later to allow frontend to start streaming the result
      // On Render free tier we MUST aggressively delete old files. 
      // Original is cleaned, we keep the annotated video so they can watch it just once.
      // Since disk space is ephemeral anyway, it wiping is expected.
      setTimeout(() => {
          safeDelete(filePath);
          if (finalNameTarget !== outFileName) safeDelete(outFilePath);
      }, 30 * 60 * 1000); // Wait 30 minutes before deleting temp result
    };

    // Try to re-encode with ffmpeg for browser compatibility
    if (fs.existsSync(outFilePath)) {
      res.write(`data: ${JSON.stringify({ status: 're-encoding' })}\n\n`);
      let responseSentFlag = false;
      const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
      const ffmpegProcess = spawn(ffmpegPath, [
        '-y', '-i', outFilePath,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        '-an', browserReadyPath
      ]);

      ffmpegProcess.on('error', (err) => {
        if (!responseSentFlag) {
          responseSentFlag = true;
          console.log(`[ffmpeg] Not available (${err.message}), using OpenCV output as fallback`);
          finalVideoName = outFileName;
          sendResponse(finalVideoName);
        }
      });

      ffmpegProcess.on('close', (ffmpegCode) => {
        if (!responseSentFlag) {
          responseSentFlag = true;
          if (ffmpegCode === 0 && fs.existsSync(browserReadyPath)) {
            console.log(`[ffmpeg] Successfully re-encoded to ${browserReadyName}`);
            // Delete the unweb-optimized opencv output immediately to save space
            safeDelete(outFilePath);
            finalVideoName = browserReadyName;
          } else {
            console.log(`[ffmpeg] Failed (code ${ffmpegCode}), using OpenCV output as fallback`);
            finalVideoName = outFileName;
          }
          sendResponse(finalVideoName);
        }
      });
    } else {
      // Annotated file doesn't exist, use original upload
      console.log(`[AI Analysis] No annotated file found at ${outFilePath}, using original upload`);
      finalVideoName = safeName;
      sendResponse(finalVideoName);
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
