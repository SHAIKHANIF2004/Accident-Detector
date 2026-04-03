import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Camera, Plus, Trash2, MapPin, Video, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function CameraManagementPage() {
  const { isDark } = useTheme();
  const [cameras, setCameras] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', videoSource: '', lat: '', lng: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchCameras(); }, []);

  const fetchCameras = () => { api.get('/cameras').then(r => setCameras(r.data.cameras)).catch(() => {}); };

  const handleAdd = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.post('/cameras', { ...form, lat: parseFloat(form.lat) || 28.6139, lng: parseFloat(form.lng) || 77.2090 });
      fetchCameras(); setShowForm(false); setForm({ name: '', location: '', videoSource: '', lat: '', lng: '' });
    } catch (err) { setError(err.response?.data?.error || 'Failed to add camera.'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this camera?')) return;
    try { await api.delete(`/cameras/${id}`); fetchCameras(); } catch (err) {}
  };

  const cardClass = `rounded-2xl p-6 border ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            <Camera className="w-8 h-8 text-primary" /> Camera Management
          </h1>
          <p className="text-dark-muted text-[11px] md:text-sm mt-1">Add, configure, and remove simulated cameras</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all">
          <Plus className="w-4 h-4" /> Add Camera
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={cardClass}>
          {error && <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-danger/10 text-danger text-sm"><AlertCircle className="w-4 h-4" /> {error}</div>}
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-dark-muted mb-1.5 block">Camera Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Highway Cam 1"
                className={`w-full px-4 py-2.5 md:py-3 rounded-xl outline-none text-sm border ${isDark ? 'bg-dark-section border-dark-border focus:border-primary' : 'bg-gray-50 border-light-border focus:border-primary'}`} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-dark-muted mb-1.5 block">Location</label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required placeholder="Junction A"
                className={`w-full px-4 py-2.5 md:py-3 rounded-xl outline-none text-sm border ${isDark ? 'bg-dark-section border-dark-border focus:border-primary' : 'bg-gray-50 border-light-border focus:border-primary'}`} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-dark-muted mb-1.5 block">Video Source (filename)</label>
              <input value={form.videoSource} onChange={e => setForm({ ...form, videoSource: e.target.value })} required placeholder="camera1.mp4"
                className={`w-full px-4 py-2.5 md:py-3 rounded-xl outline-none text-sm border ${isDark ? 'bg-dark-section border-dark-border focus:border-primary' : 'bg-gray-50 border-light-border focus:border-primary'}`} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-widest text-dark-muted mb-1.5 block">Latitude</label>
                <input value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="28.6139" type="number" step="any"
                  className={`w-full px-4 py-2.5 md:py-3 rounded-xl outline-none text-sm border ${isDark ? 'bg-dark-section border-dark-border focus:border-primary' : 'bg-gray-50 border-light-border focus:border-primary'}`} />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-widest text-dark-muted mb-1.5 block">Longitude</label>
                <input value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="77.2090" type="number" step="any"
                  className={`w-full px-4 py-2.5 md:py-3 rounded-xl outline-none text-sm border ${isDark ? 'bg-dark-section border-dark-border focus:border-primary' : 'bg-gray-50 border-light-border focus:border-primary'}`} />
              </div>
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={loading}
                className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all flex items-center gap-2 disabled:opacity-50">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><Plus className="w-4 h-4" /> Add Camera</>}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Camera list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cameras.map((cam, i) => (
          <motion.div key={cam._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cardClass}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">{cam.name}</h3>
                  <p className="text-sm text-dark-muted flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {cam.location}</p>
                  <p className="text-sm text-dark-muted flex items-center gap-1 mt-0.5"><Video className="w-3 h-3" /> {cam.videoSource}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <div className={`w-2 h-2 rounded-full ${cam.isOnline ? 'bg-success' : 'bg-danger'}`} />
                    <span className="text-xs text-dark-muted">{cam.isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => handleDelete(cam._id)} className="p-2 rounded-xl text-dark-muted hover:text-danger hover:bg-danger/10 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
