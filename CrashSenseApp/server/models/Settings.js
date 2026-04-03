const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accidentThreshold: { type: Number, default: 80, min: 0, max: 100 },
  vehicleToggles: {
    cars: { type: Boolean, default: true },
    motorcycles: { type: Boolean, default: true },
    trucks: { type: Boolean, default: true },
    buses: { type: Boolean, default: true }
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
