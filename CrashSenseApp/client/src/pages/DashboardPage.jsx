import { useEffect, useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Camera, Wifi, AlertTriangle, Shield, TrendingUp, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function AnimatedCounter({ value, duration = 1500 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let start = 0;
    const end = parseInt(value) || 0;
    if (start === end) { setCount(end); return; }
    const step = Math.ceil(end / (duration / 30));
    ref.current = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(ref.current); }
      else setCount(start);
    }, 30);
    return () => clearInterval(ref.current);
  }, [value]);
  return <span className="font-mono">{count}</span>;
}

export default function DashboardPage() {
  const { isDark } = useTheme();
  const { alerts } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/incidents/stats').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
    const interval = setInterval(() => { api.get('/incidents/stats').then(r => setStats(r.data)).catch(() => {}); }, 15000);
    return () => clearInterval(interval);
  }, []);

  const metrics = user?.role === 'Admin' ? [
    { icon: Camera, label: 'Manage Cameras', value: stats?.stats?.totalCameras || '0', color: 'text-primary', bg: 'bg-primary/10' },
    { icon: Wifi, label: 'System Status', value: stats?.stats?.systemStatus === 'Optimal' ? '100' : '0', isStatus: true, color: 'text-success', bg: 'bg-success/10' },
    { icon: AlertTriangle, label: 'Global Incidents', value: stats?.stats?.totalIncidents || 0, color: 'text-danger', bg: 'bg-danger/10' },
    { icon: Shield, label: 'Total Users', value: stats?.stats?.totalUsers || 0, color: 'text-warning', bg: 'bg-warning/10' },
  ] : [
    { icon: Camera, label: 'Active Feeds', value: stats?.stats?.activeFeeds || '0', color: 'text-primary', bg: 'bg-primary/10' },
    { icon: AlertTriangle, label: 'My Detections', value: stats?.stats?.myIncidents || 0, color: 'text-success', bg: 'bg-success/10' },
    { icon: Shield, label: 'Today Accidents', value: stats?.stats?.todayIncidents || 0, color: 'text-danger', bg: 'bg-danger/10' },
    { icon: Clock, label: 'Pending Review', value: stats?.stats?.pendingAlerts || 0, color: 'text-warning', bg: 'bg-warning/10' },
  ];

  const trendData = stats?.trend?.map(t => ({ date: t._id.slice(5), incidents: t.count, confidence: Math.round(t.avgConfidence) })) || [];

  const cardClass = `rounded-2xl p-5 border transition-all ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            {user?.role === 'Admin' ? 'System Overview' : 'Monitoring Center'}
          </h1>
          <p className="text-dark-muted text-sm mt-1 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> 
            {user?.role === 'Admin' ? 'Global network status and analytics' : 'Your real-time monitoring statistics'}
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.1, duration: 0.5 }} 
            className={`${cardClass} group relative overflow-hidden active:scale-[0.98] transition-all`}
          >
            {/* Background Accent Gradient */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-20 transition-all group-hover:opacity-40 ${m.bg}`} />
            
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-widest text-dark-muted group-hover:text-primary transition-colors">{m.label}</span>
              <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center transition-all group-hover:scale-110 group-hover:rotate-6`}>
                <m.icon className={`w-5 h-5 ${m.color} ${m.isStatus ? 'animate-pulse' : ''}`} />
              </div>
            </div>
            
            <div className="relative z-10">
              <p className={`text-4xl font-black tracking-tight ${m.color} flex items-baseline gap-1`}>
                {m.isStatus ? (
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
                    </span>
                    UP
                  </span>
                ) : <AnimatedCounter value={m.value} />}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <div className={`h-1 flex-1 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'} overflow-hidden`}>
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: '100%' }} 
                    transition={{ delay: 0.5 + (i * 0.1), duration: 0.8 }}
                    className={`h-full rounded-full ${m.bg.replace('/10', '')}`} 
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className={`lg:col-span-2 ${cardClass}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> 
              {user?.role === 'Admin' ? 'Global Incident Trends' : 'Your Detection Activity'}
            </h2>
          </div>
          <div className="h-64 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={trendData}>
                  <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} width={30} />
                  <Tooltip contentStyle={{ background: '#0B0F14', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="incidents" stroke="#3B82F6" fill="url(#grad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-dark-muted text-sm">No incident data yet — start monitoring to see trends</div>
            )}
          </div>
        </motion.div>

        {/* Recent Alerts */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Recent Alerts</h2>
            <button onClick={() => navigate('/dashboard/incidents')} className="text-xs text-primary hover:underline flex items-center gap-1">View all <ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {(stats?.recentAlerts || []).slice(0, 8).map((a, i) => (
              <div key={i} className={`p-3 rounded-xl text-sm cursor-pointer transition-colors ${isDark ? 'bg-dark-section hover:bg-white/5' : 'bg-gray-50 hover:bg-gray-100'}`}
                onClick={() => navigate(`/dashboard/incidents`)}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.cameraName || 'Camera'}</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${a.confidence >= 90 ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'}`}>{a.confidence}%</span>
                </div>
                <p className="text-xs text-dark-muted mt-1">{new Date(a.timestamp).toLocaleString()}</p>
              </div>
            ))}
            {(!stats?.recentAlerts || stats.recentAlerts.length === 0) && (
              <p className="text-center text-dark-muted text-sm py-8">No alerts recorded yet</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
