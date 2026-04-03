import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, Download, AlertTriangle, Clock, Camera, Shield, Car } from 'lucide-react';
import api, { getMediaUrl } from '../services/api';
import { exportIncidentPDF } from '../utils/pdfExport';

export default function IncidentDetailsPage() {
  const { id } = useParams();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/incidents/${id}`).then(r => setIncident(r.data.incident)).catch(() => navigate('/dashboard/incidents')).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status) => {
    try {
      const res = await api.put(`/incidents/${id}/status`, { status });
      setIncident(res.data.incident);
    } catch (err) {}
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-dark-muted">Loading...</div>;
  if (!incident) return null;

  const cardClass = `rounded-2xl p-6 border ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/dashboard/incidents')} className="flex items-center gap-2 text-sm text-dark-muted hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Incident Logs
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Incident Details</h1>
          <p className="text-dark-muted text-[10px] md:text-sm mt-1 font-mono truncate max-w-[200px] md:max-w-none">ID: {incident._id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {incident.status === 'Pending Review' && (
            <>
              <button onClick={() => updateStatus('Confirmed Accident')}
                className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl bg-danger hover:bg-danger-hover text-white text-[11px] md:text-sm font-semibold transition-all">
                <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Confirm Accident</span><span className="sm:hidden">Confirm</span>
              </button>
              <button onClick={() => updateStatus('False Alarm')}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-[11px] md:text-sm font-semibold transition-all ${isDark ? 'bg-dark-section hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>
                <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Mark False Alarm</span><span className="sm:hidden">False Alarm</span>
              </button>
            </>
          )}
          <button onClick={() => exportIncidentPDF(incident)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-[11px] md:text-sm font-semibold transition-all">
            <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Download PDF</span><span className="sm:hidden">PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`lg:col-span-2 ${cardClass}`}>
          <h2 className="font-bold mb-4 flex items-center gap-2"><Camera className="w-4 h-4 text-primary" /> Incident Clip</h2>
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            {incident.videoClipPath ? (
              <video src={getMediaUrl(`/api/videos/stream/${incident.videoClipPath}`)} controls autoPlay className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-dark-muted">No video clip available</div>
            )}
          </div>
        </motion.div>

        {/* Details */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-4">
          <div className={cardClass}>
            <h2 className="font-bold mb-4">AI Analysis</h2>
            {/* Confidence Gauge */}
            <div className="text-center mb-6">
              <div className="relative w-32 h-32 mx-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke={isDark ? '#1e293b' : '#e2e8f0'} strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none"
                    stroke={incident.confidence >= 90 ? '#ef4444' : incident.confidence >= 80 ? '#f59e0b' : '#10b981'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${incident.confidence * 2.51} 251`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-mono font-bold">{incident.confidence}%</span>
                </div>
              </div>
              <p className="text-sm text-dark-muted mt-2">Accident Confidence</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-dark-muted flex items-center gap-1"><Shield className="w-3 h-3" /> Status</span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${incident.status === 'Pending Review' ? 'bg-warning/15 text-warning' : incident.status === 'Confirmed Accident' ? 'bg-danger/15 text-danger' : 'bg-dark-muted/15 text-dark-muted'}`}>{incident.status}</span>
              </div>
              <div className="flex justify-between"><span className="text-dark-muted flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Severity</span><span className="font-medium">{incident.severity}</span></div>
              <div className="flex justify-between"><span className="text-dark-muted flex items-center gap-1"><Camera className="w-3 h-3" /> Camera</span><span className="font-medium">{incident.cameraName}</span></div>
              <div className="flex justify-between"><span className="text-dark-muted flex items-center gap-1"><Clock className="w-3 h-3" /> Time</span><span className="font-mono text-xs">{new Date(incident.timestamp).toLocaleString()}</span></div>
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="font-bold mb-3 flex items-center gap-2"><Car className="w-4 h-4 text-primary" /> Detected Vehicles</h2>
            <div className="flex flex-wrap gap-2">
              {(incident.detectedObjects || []).map((obj, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize ${isDark ? 'bg-primary/10 text-primary' : 'bg-primary/10 text-primary'}`}>{obj}</span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
