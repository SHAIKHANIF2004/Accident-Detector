const Incident = require('../models/Incident');
const User = require('../models/User');
const Camera = require('../models/Camera');

exports.getIncidents = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, cameraId } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;
    if (cameraId) filter.cameraId = cameraId;
    if (search) {
      filter.$or = [
        { cameraName: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Incident.countDocuments(filter);
    const incidents = await Incident.find(filter)
      .populate('cameraId', 'name location')
      .populate('acknowledgedBy', 'name')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ incidents, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch incidents.' });
  }
};

exports.getIncident = async (req, res) => {
  try {
    const incident = await Incident.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('cameraId', 'name location videoSource')
      .populate('acknowledgedBy', 'name');
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    res.json({ incident });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch incident.' });
  }
};

exports.updateIncidentStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = { status };
    if (notes) update.notes = notes;
    if (req.user) update.acknowledgedBy = req.user._id;

    const incident = await Incident.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, update, { new: true })
      .populate('cameraId', 'name location')
      .populate('acknowledgedBy', 'name');
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    res.json({ incident });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update incident.' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Admin';
    const match = isAdmin ? {} : { userId: req.user._id };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalIncidents = await Incident.countDocuments(match);
    const todayIncidents = await Incident.countDocuments({ ...match, timestamp: { $gte: today } });
    const pendingAlerts = await Incident.countDocuments({ ...match, status: 'Pending Review' });
    const confirmedAccidents = await Incident.countDocuments({ ...match, status: 'Confirmed Accident' });

    // Global counts for Admin
    let extraStats = {};
    if (isAdmin) {
      extraStats.totalUsers = await User.countDocuments();
      extraStats.totalCameras = await Camera.countDocuments();
      extraStats.systemStatus = 'Optimal';
    } else {
      extraStats.activeFeeds = await Camera.countDocuments(); // Simplification: all cameras are active
      extraStats.myIncidents = totalIncidents;
    }

    // 7-day trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const trend = await Incident.aggregate([
      { $match: { ...match, timestamp: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Recent alerts
    const recentAlerts = await Incident.find(match)
      .populate('cameraId', 'name location')
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      stats: { totalIncidents, todayIncidents, pendingAlerts, confirmedAccidents, ...extraStats },
      trend,
      recentAlerts
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
  }
};

exports.deleteIncident = async (req, res) => {
  try {
    const incident = await Incident.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    res.json({ message: 'Incident deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete incident.' });
  }
};
