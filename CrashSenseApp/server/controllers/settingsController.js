const Settings = require('../models/Settings');

exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.user._id });
    if (!settings) {
      settings = await Settings.create({ userId: req.user._id });
    }
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { accidentThreshold, vehicleToggles } = req.body;
    let settings = await Settings.findOne({ userId: req.user._id });
    if (!settings) settings = new Settings({ userId: req.user._id });

    if (accidentThreshold !== undefined) settings.accidentThreshold = accidentThreshold;
    if (vehicleToggles) settings.vehicleToggles = { ...settings.vehicleToggles, ...vehicleToggles };
    settings.updatedBy = req.user._id;
    settings.updatedAt = new Date();
    await settings.save();

    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings.' });
  }
};
