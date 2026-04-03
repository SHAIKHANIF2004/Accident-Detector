// Load .env.example as defaults, then override with .env (local dev) or environment vars (Render)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.example') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
require('dotenv').config({ override: true }); // Also check server/.env if exists

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const Camera = require('./models/Camera');
const Incident = require('./models/Incident');
const Settings = require('./models/Settings');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cameras', require('./routes/cameras'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/videos', require('./routes/videos'));

// Make sure express trusts proxy if hosted on Render behind load balancers
app.set('trust proxy', 1);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Socket.IO connection
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`❌ Client disconnected: ${socket.id}`));
});

// ─── AI Simulation Loop (Embedded) ────────────────────────────
let simulationInterval = null;

// Track state for each camera to make simulation realistic
const cameraStates = {};

function simulateDetection(camera) {
  const cameraId = camera._id.toString();
  const videoSource = camera.videoSource;
  if (!cameraStates[cameraId]) {
    cameraStates[cameraId] = {
      baseProb: 15,
      trend: 0,
      isSpiking: false,
      cooldown: 0
    };
  }

  const state = cameraStates[cameraId];

  if (state.cooldown > 0) {
    state.cooldown--;
    state.baseProb = Math.max(15, state.baseProb - 15);
  } else if (state.isSpiking) {
    state.baseProb += 30 + Math.random() * 20;
    if (state.baseProb >= 95) {
      state.isSpiking = false;
      state.cooldown = 3; // Cool down for next 3 cycles (~24s)
    }
  } else {
    // Normal behavior: only trigger if a high-risk scenario is simulated or randomly
    if (Math.random() < 0.005) { // 0.5% chance to start a spike
      state.isSpiking = true;
    } else {
      // Normal drift between 10-35%
      state.trend = (Math.random() - 0.5) * 10;
      state.baseProb = Math.max(10, Math.min(35, state.baseProb + state.trend));
    }
  }

  const roundedProb = Math.min(99, Math.round(state.baseProb));
  const objects = ['car', 'car'];
  if (Math.random() > 0.7) objects.push('truck');
  if (Math.random() > 0.8) objects.push('motorcycle');

  return {
    accidentProbability: roundedProb,
    detectedObjects: objects,
    timestamp: new Date().toISOString()
  };
}

async function runSimulationCycle() {
  try {
    const cameras = await Camera.find({ isOnline: true });
    const settings = await Settings.findOne() || { accidentThreshold: 80 };

    for (const camera of cameras) {
      try {
        // Generate simulated detection locally
        const detection = simulateDetection(camera);

        // Broadcast detection to all connected clients
        io.emit('detection', {
          userId: camera.userId,
          cameraId: camera._id,
          cameraName: camera.name,
          location: camera.location,
          ...detection
        });

        // Create incident if threshold exceeded
        if (detection.accidentProbability >= settings.accidentThreshold) {
          const severity = detection.accidentProbability >= 95 ? 'Critical'
            : detection.accidentProbability >= 90 ? 'High'
            : detection.accidentProbability >= 85 ? 'Medium' : 'Low';

          const incident = await Incident.create({
            userId: camera.userId,
            cameraId: camera._id,
            cameraName: camera.name,
            confidence: detection.accidentProbability,
            detectedObjects: detection.detectedObjects,
            severity,
            videoClipPath: camera.videoSource
          });

          io.emit('alert', {
            id: incident._id,
            userId: camera.userId,
            cameraId: camera._id,
            cameraName: camera.name,
            location: camera.location,
            confidence: detection.accidentProbability,
            detectedObjects: detection.detectedObjects,
            severity,
            timestamp: incident.timestamp
          });

          console.log(`\n🚨 ALERT: Accident detected on ${camera.name} (${detection.accidentProbability}%) for user ${camera.userId}`);
        }
      } catch (err) {
        console.error(`Error simulating camera ${camera.name}:`, err.message);
      }
    }
  } catch (error) {
    console.error('Simulation cycle error:', error.message);
  }
}

function startSimulation() {
  if (simulationInterval) return;
  console.log('🤖 AI Simulation loop started (every 8 seconds)');
  simulationInterval = setInterval(runSimulationCycle, 8000);
  // Run first cycle immediately
  setTimeout(runSimulationCycle, 2000);
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log('🤖 AI Simulation loop stopped');
  }
}

// Make io accessible to routes
app.set('io', io);

// Start
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 CrashSense Server running on port ${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
    startSimulation();
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  stopSimulation();
  process.exit(0);
});
