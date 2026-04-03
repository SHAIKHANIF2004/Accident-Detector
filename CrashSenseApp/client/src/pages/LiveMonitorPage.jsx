import { useEffect, useState, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MonitorPlay, MapPin, AlertTriangle, Volume2, VolumeX,
  Maximize2, Minimize2, Camera, Plus, X, Wifi, WifiOff,
  Shield, Clock, Activity, ChevronRight, Bell, RefreshCw,
  Loader2, Trash2, Eye
} from 'lucide-react';
import api, { getMediaUrl } from '../services/api';

export default function LiveMonitorPage() {
  const { isDark } = useTheme();
  const { socket, detections, alerts, connected, clearAlerts } = useSocket();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expandedCamera, setExpandedCamera] = useState(null);
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [newCamera, setNewCamera] = useState({ name: '', location: '', videoSource: '' });
  const [addingCamera, setAddingCamera] = useState(false);
  const audioRef = useRef(null);

  // Fetch cameras
  const fetchCameras = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras');
      setCameras(res.data.cameras || []);
    } catch (err) {
      console.error('Failed to fetch cameras:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCameras(); }, [fetchCameras]);

  // Play alarm on new high-confidence alert
  useEffect(() => {
    if (alerts.length > 0 && soundEnabled) {
      const latest = alerts[0];
      if (latest.confidence >= 80) {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZeWj4F0aGBneIOPlpaRhXZpYGR5iJaYlY2BdGdgZXqJlpiWjoJ1aGBkeomWmJaOgnVnYGR6iZaYlo6CdWdgZHqJlpiWjoJ1Z2BkeomWmJaOgnVnYGR6iZaYlo6CdWdgZHqJlg==');
          }
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        } catch (e) {}
      }
    }
  }, [alerts.length, soundEnabled]);

  // Add camera handler
  const handleAddCamera = async () => {
    if (!newCamera.name || !newCamera.location || !newCamera.videoSource) return;
    setAddingCamera(true);
    try {
      await api.post('/cameras', newCamera);
      setNewCamera({ name: '', location: '', videoSource: '' });
      setShowAddCamera(false);
      fetchCameras();
    } catch (err) {
      console.error('Failed to add camera:', err);
    } finally {
      setAddingCamera(false);
    }
  };

  // Delete camera handler
  const handleDeleteCamera = async (id) => {
    try {
      await api.delete(`/cameras/${id}`);
      fetchCameras();
      if (expandedCamera === id) setExpandedCamera(null);
    } catch (err) {
      console.error('Failed to delete camera:', err);
    }
  };

  const cardClass = `rounded-2xl border overflow-hidden transition-all ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`;
  const sectionBg = isDark ? 'bg-dark-section' : 'bg-gray-50';

  // Stats
  const activeAlerts = alerts.filter(a => a.confidence >= 80).length;
  const totalCameras = cameras.length;
  const onlineCameras = cameras.filter(c => c.isOnline !== false).length;

  // Severity color helper
  const getSeverityColor = (confidence) => {
    if (confidence >= 95) return { bg: 'bg-red-500', text: 'text-red-400', label: 'CRITICAL' };
    if (confidence >= 90) return { bg: 'bg-orange-500', text: 'text-orange-400', label: 'HIGH' };
    if (confidence >= 85) return { bg: 'bg-yellow-500', text: 'text-yellow-400', label: 'MEDIUM' };
    return { bg: 'bg-blue-500', text: 'text-blue-400', label: 'LOW' };
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            <MonitorPlay className="w-8 md:w-8 h-8 md:h-8 text-primary" /> Live Monitor
          </h1>
          <p className="text-dark-muted text-[11px] md:text-sm mt-1">Real-time camera feeds with AI accident detection overlay</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap sm:flex-nowrap">
          {/* Connection status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 md:py-2 rounded-xl text-[10px] md:text-xs font-medium border ${
            connected 
              ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600')
              : (isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600')
          }`}>
            {connected ? <Wifi className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <WifiOff className="w-3 h-3 md:w-3.5 md:h-3.5" />}
            <span className="whitespace-nowrap">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>

          <button onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 md:py-2 rounded-xl text-[10px] md:text-xs font-medium transition-colors border ${isDark ? 'bg-dark-card border-dark-border hover:bg-white/5' : 'bg-white border-light-border hover:bg-gray-50 shadow-sm'}`}>
            {soundEnabled ? <Volume2 className="w-3 h-3 md:w-3.5 md:h-3.5 text-success" /> : <VolumeX className="w-3 h-3 md:w-3.5 md:h-3.5 text-dark-muted" />}
            <span className="whitespace-nowrap">{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
          </button>

          <button onClick={() => setShowAddCamera(true)}
            className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] md:text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-colors">
            <Plus className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="whitespace-nowrap">Add Camera</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { icon: <Camera className="w-4 h-4" />, label: 'Total Cameras', value: totalCameras, color: 'text-primary' },
          { icon: <Eye className="w-4 h-4" />, label: 'Online', value: onlineCameras, color: 'text-emerald-400' },
          { icon: <AlertTriangle className="w-4 h-4" />, label: 'Active Alerts', value: activeAlerts, color: 'text-red-400' },
          { icon: <Activity className="w-4 h-4" />, label: 'AI Status', value: connected ? 'Active' : 'Offline', color: connected ? 'text-emerald-400' : 'text-red-400' },
        ].map((stat, i) => (
          <div key={i} className={`${cardClass} px-4 py-3 flex items-center gap-3`}>
            <div className={stat.color}>{stat.icon}</div>
            <div>
              <p className="text-lg font-black">{stat.value}</p>
              <p className="text-[10px] text-dark-muted uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content: Cameras + Alert Feed */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Camera Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : cameras.length === 0 ? (
            <div className={`${cardClass} text-center py-16`}>
              <MonitorPlay className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-semibold mb-1">No Cameras Configured</p>
              <p className="text-sm text-dark-muted mb-4">Add your first camera to start monitoring</p>
              <button onClick={() => setShowAddCamera(true)}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold transition-colors">
                <Plus className="w-4 h-4 inline mr-2" /> Add Camera
              </button>
            </div>
          ) : (
            <div className={`grid ${expandedCamera ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
              <AnimatePresence mode="popLayout">
                {cameras
                  .filter(cam => !expandedCamera || expandedCamera === cam._id)
                  .map((cam) => {
                    const detection = detections[cam._id];
                    const isAlert = detection && detection.accidentProbability >= 80;
                    const isExpanded = expandedCamera === cam._id;
                    const prob = detection?.accidentProbability || 0;
                    const probColor = prob >= 80 ? 'text-red-400' : prob >= 50 ? 'text-yellow-400' : 'text-emerald-400';

                    return (
                      <motion.div
                        key={cam._id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className={`${cardClass} ${isAlert ? 'ring-2 ring-red-500/50' : ''}`}
                      >
                        {/* Video Feed */}
                        <div className={`relative ${isExpanded ? 'aspect-[16/8]' : 'aspect-video'} bg-black overflow-hidden`}>
                          <video
                            src={getMediaUrl(`/api/videos/stream/${cam.videoSource}`)}
                            autoPlay muted loop playsInline
                            className="w-full h-full object-cover"
                          />

                          {/* Scan line effect */}
                          <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute left-0 w-full h-0.5 bg-primary/30 animate-scan-line" />
                          </div>

                          {/* AI Detection Overlay — HUD Design */}
                          <AnimatePresence>
                            {detection && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className={`absolute inset-x-0 bottom-0 p-4 transition-colors duration-500 ${isAlert ? 'bg-red-500/20' : 'bg-black/40'} pointer-events-none`}
                              >
                                <div className="flex flex-col gap-2">
                                  {/* Top HUD Row */}
                                  <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                    <div className="flex flex-col">
                                      <span className="text-[8px] uppercase tracking-tighter text-white/40">Object Identification</span>
                                      <div className="flex gap-2">
                                        {detection.detectedObjects?.map((obj, i) => (
                                          <motion.span 
                                            key={i}
                                            initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                                            className="text-[10px] font-black text-white bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-sm"
                                          >
                                            {obj.toUpperCase()}
                                          </motion.span>
                                        )) || <span className="text-white/20 text-[10px]">Scanning...</span>}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[8px] uppercase tracking-tighter text-white/40 block">Safety Coefficient</span>
                                      <span className={`text-xl font-black font-mono leading-none ${probColor}`}>{100 - prob}%</span>
                                    </div>
                                  </div>

                                  {/* Bottom HUD Row */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex gap-4">
                                      <div className="flex flex-col">
                                        <span className="text-[8px] uppercase tracking-tighter text-white/40 text-[7px]">Processer</span>
                                        <span className="text-[9px] text-white/80 font-mono italic">YOLO-v8.h5</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[8px] uppercase tracking-tighter text-white/40 text-[7px]">Alert Prob.</span>
                                        <span className={`text-[9px] font-mono font-bold ${probColor}`}>{prob}%</span>
                                      </div>
                                    </div>
                                    <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                                      <motion.div 
                                        className={`h-full rounded-full ${prob >= 80 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}
                                        initial={{ width: 0 }} animate={{ width: `${prob}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Alert badge — top right */}
                          <AnimatePresence>
                            {isAlert && (
                              <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="absolute top-3 right-3 z-10"
                              >
                                <div className="relative group">
                                  <div className="absolute inset-0 bg-red-500 blur-md animate-pulse opacity-50" />
                                  <div className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black shadow-2xl border border-red-400/50">
                                    <AlertTriangle className="w-4 h-4 animate-bounce" /> 
                                    <span className="tracking-tighter">ACCIDENT THRESHOLD EXCEEDED</span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* LIVE badge — top left */}
                          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE
                          </div>

                          {/* Expand/Collapse — top right (below alert if present) */}
                          <button
                            onClick={() => setExpandedCamera(isExpanded ? null : cam._id)}
                            className={`absolute ${isAlert ? 'top-12' : 'top-3'} right-3 p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/80 hover:text-white transition-all hover:bg-black/80`}
                          >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Camera Info */}
                        <div className="px-4 py-3 flex items-center justify-between">
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm truncate">{cam.name}</h3>
                            <p className="text-xs text-dark-muted flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{cam.location}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Real-time probability indicator */}
                            {detection && (
                              <div className={`text-xs font-mono font-bold px-2 py-1 rounded-lg ${
                                isAlert
                                  ? 'bg-red-500/10 text-red-400'
                                  : prob >= 50
                                    ? 'bg-yellow-500/10 text-yellow-400'
                                    : 'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {prob}%
                              </div>
                            )}
                            <button
                              onClick={() => handleDeleteCamera(cam._id)}
                              className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Remove camera"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
            </div>
          )}

          {/* Back to grid button */}
          {expandedCamera && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setExpandedCamera(null)}
              className="mt-3 w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              <Minimize2 className="w-4 h-4" /> Back to Grid View
            </motion.button>
          )}
        </div>

        {/* Alert Feed Sidebar */}
        <div className={`w-full lg:w-80 shrink-0 ${cardClass} flex flex-col`} style={{ maxHeight: 'calc(100vh - 220px)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between shrink-0" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">Live Alerts</h3>
              {alerts.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{alerts.length}</span>
              )}
            </div>
            {alerts.length > 0 && (
              <button onClick={clearAlerts} className="text-xs text-dark-muted hover:text-primary transition-colors">
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="py-12 text-center">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-15" />
                <p className="text-xs text-dark-muted">No alerts yet</p>
                <p className="text-[10px] text-dark-muted mt-1">Monitoring all camera feeds...</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                <AnimatePresence initial={false}>
                  {alerts.slice(0, 20).map((alert, i) => {
                    const sev = getSeverityColor(alert.confidence);
                    return (
                      <motion.div
                        key={alert.id || i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className={`px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${sev.bg}/10`}>
                          <AlertTriangle className={`w-4 h-4 ${sev.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold truncate">{alert.cameraName}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sev.bg} text-white`}>
                              {sev.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-dark-muted truncate">
                            {alert.location}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[11px] font-mono font-bold ${sev.text}`}>{alert.confidence}%</span>
                            <span className="text-[10px] text-dark-muted">•</span>
                            <span className="text-[10px] text-dark-muted flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'just now'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-dark-muted shrink-0 mt-2" />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Camera Modal */}
      <AnimatePresence>
        {showAddCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAddCamera(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl border p-6 ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-xl'}`}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-black flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary" /> Add Camera
                </h2>
                <button onClick={() => setShowAddCamera(false)} className="p-1 rounded-lg hover:bg-dark-section transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-dark-muted mb-1.5">Camera Name</label>
                  <input
                    type="text"
                    value={newCamera.name}
                    onChange={(e) => setNewCamera(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Highway Cam 5"
                    className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-colors ${isDark ? 'bg-dark-section border-dark-border focus:border-primary' : 'bg-gray-50 border-light-border focus:border-primary'} outline-none`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-dark-muted mb-1.5">Location</label>
                  <input
                    type="text"
                    value={newCamera.location}
                    onChange={(e) => setNewCamera(p => ({ ...p, location: e.target.value }))}
                    placeholder="e.g., Junction B - NH24"
                    className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-colors ${isDark ? 'bg-dark-section border-dark-border focus:border-primary' : 'bg-gray-50 border-light-border focus:border-primary'} outline-none`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-dark-muted mb-1.5">Video Source</label>
                  <input
                    type="text"
                    value={newCamera.videoSource}
                    onChange={(e) => setNewCamera(p => ({ ...p, videoSource: e.target.value }))}
                    placeholder="e.g., camera5.mp4"
                    className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-colors ${isDark ? 'bg-dark-section border-dark-border focus:border-primary' : 'bg-gray-50 border-light-border focus:border-primary'} outline-none`}
                  />
                  <p className="text-[10px] text-dark-muted mt-1">File name from sample-videos folder or RTSP stream URL</p>
                </div>

                <button
                  onClick={handleAddCamera}
                  disabled={addingCamera || !newCamera.name || !newCamera.location || !newCamera.videoSource}
                  className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {addingCamera ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><Plus className="w-4 h-4" /> Add Camera</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
