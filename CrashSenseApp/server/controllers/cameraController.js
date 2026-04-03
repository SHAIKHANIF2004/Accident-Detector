const Camera = require('../models/Camera');

exports.getCameras = async (req, res) => {
  try {
    const cameras = await Camera.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ cameras });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cameras.' });
  }
};

exports.getCamera = async (req, res) => {
  try {
    const camera = await Camera.findOne({ _id: req.params.id, userId: req.user._id });
    if (!camera) return res.status(404).json({ error: 'Camera not found.' });
    res.json({ camera });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch camera.' });
  }
};

exports.createCamera = async (req, res) => {
  try {
    const { name, location, videoSource, lat, lng } = req.body;
    if (!name || !location || !videoSource) {
      return res.status(400).json({ error: 'Name, location, and video source are required.' });
    }
    const camera = new Camera({ name, location, videoSource, lat, lng, userId: req.user._id });
    await camera.save();
    res.status(201).json({ camera });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create camera.' });
  }
};

exports.updateCamera = async (req, res) => {
  try {
    const camera = await Camera.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, req.body, { new: true });
    if (!camera) return res.status(404).json({ error: 'Camera not found.' });
    res.json({ camera });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update camera.' });
  }
};

exports.deleteCamera = async (req, res) => {
  try {
    const camera = await Camera.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!camera) return res.status(404).json({ error: 'Camera not found.' });
    res.json({ message: 'Camera deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete camera.' });
  }
};
