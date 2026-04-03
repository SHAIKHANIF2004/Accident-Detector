import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';
import { Settings, Sliders, Car, Bike, Truck, Bus, Sun, Moon, Monitor, Info } from 'lucide-react';
import api from '../services/api';

export default function SettingsPage() {
  const { isDark, toggleTheme, theme } = useTheme();
  const [settings, setSettings] = useState(null);
  const [threshold, setThreshold] = useState(80);
  const [toggles, setToggles] = useState({ cars: true, motorcycles: true, trucks: true, buses: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => {
      setSettings(r.data.settings);
      setThreshold(r.data.settings.accidentThreshold);
      setToggles(r.data.settings.vehicleToggles);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await api.put('/settings', { accidentThreshold: threshold, vehicleToggles: toggles });
      setSettings(res.data.settings);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) {} finally { setSaving(false); }
  };

  const cardClass = `rounded-2xl p-6 border ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`;

  const vehicleTypes = [
    { key: 'cars', label: 'Cars', icon: Car },
    { key: 'motorcycles', label: 'Motorcycles', icon: Bike },
    { key: 'trucks', label: 'Trucks', icon: Truck },
    { key: 'buses', label: 'Buses', icon: Bus },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            <Settings className="w-8 h-8 text-primary" /> System Settings
          </h1>
          <p className="text-dark-muted text-[11px] md:text-sm mt-1">Configure AI detection thresholds and system preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Threshold */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cardClass}>
          <h2 className="font-bold mb-4 flex items-center gap-2"><Sliders className="w-4 h-4 text-primary" /> Accident Confidence Threshold</h2>
          <p className="text-sm text-dark-muted mb-6">Alerts trigger when AI confidence exceeds this value.</p>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-dark-muted">Threshold</span>
              <span className={`text-2xl font-mono font-bold ${threshold >= 90 ? 'text-danger' : threshold >= 70 ? 'text-warning' : 'text-success'}`}>{threshold}%</span>
            </div>
            <input type="range" min="0" max="100" value={threshold} onChange={e => setThreshold(parseInt(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
              style={{ background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${threshold}%, ${isDark ? '#1e293b' : '#e2e8f0'} ${threshold}%, ${isDark ? '#1e293b' : '#e2e8f0'} 100%)` }} />
            <div className="flex justify-between text-xs text-dark-muted mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
          </div>
        </motion.div>

        {/* Vehicle Toggles */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={cardClass}>
          <h2 className="font-bold mb-4 flex items-center gap-2"><Car className="w-4 h-4 text-primary" /> Vehicle Detection Filters</h2>
          <p className="text-sm text-dark-muted mb-6">Select which vehicle types to monitor for accidents.</p>
          <div className="space-y-3">
            {vehicleTypes.map(v => (
              <label key={v.key}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${isDark ? 'bg-dark-section hover:bg-white/5' : 'bg-gray-50 hover:bg-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <v.icon className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{v.label}</span>
                </div>
                <div className="relative">
                  <input type="checkbox" checked={toggles[v.key]} onChange={() => setToggles(prev => ({ ...prev, [v.key]: !prev[v.key] }))}
                    className="sr-only" />
                  <div className={`w-10 h-6 rounded-full transition-colors ${toggles[v.key] ? 'bg-primary' : isDark ? 'bg-dark-border' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform mt-1 ${toggles[v.key] ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                </div>
              </label>
            ))}
          </div>
        </motion.div>

        {/* Theme */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={cardClass}>
          <h2 className="font-bold mb-4 flex items-center gap-2"><Monitor className="w-4 h-4 text-primary" /> Appearance</h2>
          <div className="flex gap-3">
            {[{ key: 'dark', icon: Moon, label: 'Dark Mode' }, { key: 'light', icon: Sun, label: 'Light Mode' }].map(t => (
              <button key={t.key} onClick={() => { if (theme !== t.key) toggleTheme(); }}
                className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${theme === t.key ? 'border-primary bg-primary/10' : isDark ? 'border-dark-border hover:border-primary/30' : 'border-light-border hover:border-primary/30'}`}>
                <t.icon className={`w-5 h-5 ${theme === t.key ? 'text-primary' : 'text-dark-muted'}`} />
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* System Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={cardClass}>
          <h2 className="font-bold mb-4 flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> System Information</h2>
          <div className="space-y-2 text-sm">
            {[
              ['Application', 'CrashSense v1.0'],
              ['Frontend', 'React + Vite + Tailwind v4'],
              ['Backend', 'Node.js + Express + MongoDB'],
              ['AI Service', 'Python FastAPI (Simulation)'],
              ['Real-time', 'Socket.IO WebSocket'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-dark-muted">{k}</span><span className="font-mono text-xs">{v}</span></div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all flex items-center gap-2 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-success text-sm font-medium">✓ Settings saved</motion.span>}
      </div>
    </div>
  );
}
