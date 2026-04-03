import { useEffect, useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, History, Calendar, Trash2, Eye, ShieldAlert, CheckCircle2, 
  AlertTriangle, Activity, Clock, FileText, ChevronRight, Play, 
  Info, Car, ChevronDown, ChevronUp, MapPin, Loader2, Search
} from 'lucide-react';
import api, { getMediaUrl } from '../services/api';

// ── Helper utilities (duplicated from VideoAnalysisPage for consistency) ──

function getSeverity(confidence) {
  if (confidence >= 85) return { level: 'Critical', color: 'bg-red-500', textColor: 'text-red-400', bgLight: 'bg-red-500/10', border: 'border-red-500/30' };
  if (confidence >= 70) return { level: 'High', color: 'bg-orange-500', textColor: 'text-orange-400', bgLight: 'bg-orange-500/10', border: 'border-orange-500/30' };
  if (confidence >= 50) return { level: 'Moderate', color: 'bg-yellow-500', textColor: 'text-yellow-400', bgLight: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
  return { level: 'Low', color: 'bg-blue-500', textColor: 'text-blue-400', bgLight: 'bg-blue-500/10', border: 'border-blue-500/30' };
}

function getIncidentDescription(marker) {
  const objects = marker.objects || ['vehicle'];
  const conf = marker.confidence;
  const objectStr = objects.join(' and ');

  if (conf >= 85) return `A high-confidence collision involving ${objectStr} was detected. The impact pattern suggests a direct collision event with significant force.`;
  if (conf >= 70) return `A probable collision involving ${objectStr} was identified. The trajectory and motion analysis indicate a traffic incident with moderate-to-high impact severity.`;
  if (conf >= 50) return `A potential incident involving ${objectStr} was detected. The AI observed unusual motion patterns that suggest a possible collision or near-miss event.`;
  return `Minor anomaly involving ${objectStr} was flagged. The motion patterns show a deviation from normal traffic flow.`;
}

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function AnalysisHistoryPage() {
  const { isDark } = useTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [expandedIncident, setExpandedIncident] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const videoRef = useRef(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/videos/history');
      setHistory(res.data.history || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/videos/history/${itemToDelete}`);
      setHistory(history.filter(item => item._id !== itemToDelete));
      if (selectedAnalysis?._id === itemToDelete) setSelectedAnalysis(null);
      setItemToDelete(null);
    } catch (err) {
      console.error('Failed to delete analysis:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const seekTo = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const filteredHistory = history.filter(item => 
    item.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cardClass = `rounded-2xl border transition-all ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`;

  if (selectedAnalysis) {
    const res = selectedAnalysis;
    const isAccident = res.markers?.length > 0;
    const overallSeverity = isAccident ? getSeverity(Math.max(...res.markers.map(m => m.confidence))) : null;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <button onClick={() => setSelectedAnalysis(null)} className="flex items-center gap-2 text-primary font-bold hover:underline">
            <ChevronRight className="w-5 h-5 rotate-180" /> Back to History
          </button>
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3">
             <span className="text-[10px] md:text-xs text-dark-muted font-mono truncate max-w-[150px]">{res._id}</span>
             <button onClick={(e) => handleDelete(res._id, e)} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                <Trash2 className="w-4 h-4" />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className={`${cardClass} aspect-video bg-black overflow-hidden flex items-center justify-center`}>
              <video 
                ref={videoRef}
                src={getMediaUrl(res.annotatedVideoUrl || res.originalVideoPath)} 
                className="w-full h-full object-contain"
                controls
              />
           </div>

           <div className="space-y-4">
              <div className={cardClass + " p-6"}>
                 <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-xl ${isAccident ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                       {isAccident ? <ShieldAlert className="w-6 h-6 text-red-400" /> : <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
                    </div>
                    <div>
                       <h2 className="text-xl font-black">{isAccident ? 'Accident Detected' : 'No Accident Detected'}</h2>
                       <p className="text-sm text-dark-muted">{res.fileName}</p>
                    </div>
                    {overallSeverity && (
                       <div className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${overallSeverity.color} text-white`}>
                          {overallSeverity.level} Severity
                       </div>
                    )}
                 </div>

                 <div className="grid grid-cols-2 gap-3 mt-6">
                    <div className="p-3 rounded-xl bg-dark-section/30 border border-dark-border/50">
                       <p className="text-[10px] uppercase font-bold text-dark-muted tracking-widest mb-1">Processed At</p>
                       <p className="text-sm font-semibold">{new Date(res.processedAt).toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-dark-section/30 border border-dark-border/50">
                       <p className="text-[10px] uppercase font-bold text-dark-muted tracking-widest mb-1">File Size</p>
                       <p className="text-sm font-semibold">{(res.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                 </div>
              </div>

              {isAccident && (
                 <div className={cardClass + " p-6"}>
                    <h3 className="font-bold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Incident Timeline</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                       {res.markers.map((m, i) => (
                          <button key={i} onClick={() => seekTo(m.time)} 
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-dark-section/50 hover:bg-white/5 transition-colors text-sm">
                             <span className="font-mono text-primary">{formatTimestamp(m.time)}</span>
                             <span className="font-medium">{m.objects.join(', ')}</span>
                             <span className="text-red-400 font-bold">{m.confidence}%</span>
                          </button>
                       ))}
                    </div>
                 </div>
              )}
           </div>
        </div>

        {isAccident && (
           <div className={cardClass + " overflow-hidden"}>
              <div className="px-6 py-4 border-b border-inherit bg-dark-section/30 flex items-center gap-2">
                 <FileText className="w-5 h-5 text-primary" />
                 <h3 className="font-black text-lg">Detailed Analysis Breakdown</h3>
              </div>
              <div className="divide-y divide-inherit">
                 {res.markers.map((marker, idx) => {
                    const sev = getSeverity(marker.confidence);
                    const isExpanded = expandedIncident === idx;
                    return (
                       <div key={idx}>
                          <button 
                            onClick={() => setExpandedIncident(isExpanded ? null : idx)}
                            className="w-full px-6 py-5 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
                          >
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sev.bgLight}`}>
                                <AlertTriangle className={`w-5 h-5 ${sev.textColor}`} />
                             </div>
                             <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                   <span className="font-bold">Incident #{idx + 1}</span>
                                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sev.color} text-white`}>{sev.level}</span>
                                </div>
                                <p className="text-xs text-dark-muted">{marker.objects.join(', ')} involved</p>
                             </div>
                             <div className="text-right mr-4 font-mono">
                                <p className="font-bold">{formatTimestamp(marker.time)}</p>
                                <p className="text-[10px] text-danger">{marker.confidence}% CONFIDENCE</p>
                             </div>
                             {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <AnimatePresence>
                             {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                   <div className="px-6 pb-6 pt-2">
                                      <div className="p-4 rounded-xl bg-dark-section/50 space-y-4">
                                         <p className="text-sm leading-relaxed text-dark-muted">{getIncidentDescription(marker)}</p>
                                         <button onClick={() => seekTo(marker.time)} className="w-full py-2.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all flex items-center justify-center gap-2">
                                            <Play className="w-3.5 h-3.5" /> JUMP TO INCIDENT
                                         </button>
                                      </div>
                                   </div>
                                </motion.div>
                             )}
                          </AnimatePresence>
                       </div>
                    );
                 })}
              </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            <History className="w-8 h-8 text-primary" /> Analysis History
          </h1>
          <p className="text-dark-muted text-[11px] md:text-sm mt-1">Review all your previous AI video analysis sessions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`${cardClass} flex items-center gap-2 px-3 py-2 text-[10px] md:text-xs font-bold uppercase tracking-widest`}>
             <Calendar className="w-4 h-4 text-primary" /> {history.length} <span className="hidden sm:inline">Records</span>
          </div>
          <button onClick={fetchHistory} className={`p-2 rounded-xl ${isDark ? 'bg-dark-card border-dark-border hover:bg-white/5' : 'bg-white shadow-sm hover:bg-gray-50'}`}>
             <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Bulk Actions */}
      <div className="flex gap-4">
         <div className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`}>
            <Search className="w-4 h-4 text-dark-muted" />
            <input 
              type="text" 
              placeholder="Filter by filename..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full"
            />
         </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-dark-muted animate-pulse">Retrieving your analysis history...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className={`${cardClass} py-20 text-center`}>
          <Video className="w-16 h-16 mx-auto mb-4 opacity-10" />
          <h3 className="text-lg font-bold mb-1">No Analysis History</h3>
          <p className="text-dark-muted max-w-xs mx-auto text-sm">You haven't analyzed any videos yet. Go to Video Analysis to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHistory.map((item, i) => {
            const hasAccident = item.markers?.length > 0;
            const maxConf = hasAccident ? Math.max(...item.markers.map(m => m.confidence)) : 0;
            const sev = getSeverity(maxConf);

            return (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  setSelectedAnalysis(item);
                  window.scrollTo(0, 0);
                }}
                className={`${cardClass} group cursor-pointer hover:border-primary/50 overflow-hidden relative`}
              >
                {/* Status indicator bar */}
                <div className={`absolute top-0 left-0 w-full h-1 ${hasAccident ? sev.color : 'bg-emerald-500'}`} />
                
                <div className="p-5">
                   <div className="flex items-start justify-between mb-3">
                      <div className={`p-2.5 rounded-xl ${hasAccident ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                         {hasAccident ? <ShieldAlert className="w-5 h-5 text-red-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      </div>
                      <button onClick={(e) => handleDelete(item._id, e)} className="p-1.5 rounded-lg text-dark-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
                         <Trash2 className="w-4 h-4" />
                      </button>
                   </div>

                   <h3 className="font-bold text-base truncate mb-1 group-hover:text-primary transition-colors">{item.fileName}</h3>
                   <p className="text-xs text-dark-muted mb-4 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.processedAt).toLocaleDateString()} at {new Date(item.processedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </p>

                   <div className="flex items-center justify-between pt-4 border-t border-inherit">
                      {hasAccident ? (
                         <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-black text-red-400 tracking-widest">{item.markers.length} INCIDENTS</span>
                            <span className="text-sm font-black">{maxConf}% Conf.</span>
                         </div>
                      ) : (
                         <span className="text-xs font-bold text-emerald-500">CLEAR • NO ACCIDENTS</span>
                      )}
                      <div className="flex items-center gap-1 text-primary text-xs font-bold group-hover:gap-2 transition-all">
                        View Details <ChevronRight className="w-4 h-4" />
                      </div>
                   </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setItemToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-md overflow-hidden rounded-2xl shadow-2xl border ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border'}`}
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Delete Analysis?</h3>
                    <p className="text-sm text-dark-muted">This action cannot be undone. All data for this analysis will be permanently removed.</p>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button 
                    disabled={isDeleting}
                    onClick={() => setItemToDelete(null)}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${isDark ? 'bg-dark-section hover:bg-white/5' : 'bg-gray-100 hover:bg-gray-200'} disabled:opacity-50`}
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isDeleting}
                    onClick={confirmDelete}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Confirm Delete'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
