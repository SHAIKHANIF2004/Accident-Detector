const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    default: 0
  },
  markers: [{
    time: Number,
    confidence: Number,
    objects: [String]
  }],
  originalVideoPath: {
    type: String
  },
  annotatedVideoUrl: {
    type: String
  },
  processedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Analysis', AnalysisSchema);
