const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cameraId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camera', required: true },
  cameraName: { type: String, default: '' },
  confidence: { type: Number, required: true, min: 0, max: 100 },
  detectedObjects: [{ type: String }],
  status: { type: String, enum: ['Pending Review', 'Confirmed Accident', 'False Alarm'], default: 'Pending Review' },
  severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  videoClipPath: { type: String, default: '' },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

incidentSchema.index({ timestamp: -1 });
incidentSchema.index({ status: 1 });
incidentSchema.index({ cameraId: 1 });
incidentSchema.index({ userId: 1 });

module.exports = mongoose.model('Incident', incidentSchema);
