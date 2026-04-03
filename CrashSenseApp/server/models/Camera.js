const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  videoSource: { type: String, required: true },
  isOnline: { type: Boolean, default: true },
  lat: { type: Number, default: 28.6139 },
  lng: { type: Number, default: 77.2090 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Camera', cameraSchema);
