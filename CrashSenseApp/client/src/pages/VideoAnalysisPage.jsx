import { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Video, Play, AlertTriangle, Clock, Loader2, CheckCircle2, ShieldAlert, Car, Activity, FileText, MapPin, Eye, Info, ChevronDown, ChevronUp } from 'lucide-react';
import api, { getMediaUrl } from '../services/api';
import { useSocket } from '../context/SocketContext';

// ── Helper utilities for the detailed report ──

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

  if (conf >= 85) {
    return `A high-confidence collision involving ${objectStr} was detected. The impact pattern suggests a direct collision event with significant force. Immediate review is recommended.`;
  }
  if (conf >= 70) {
    return `A probable collision involving ${objectStr} was identified. The trajectory and motion analysis indicate a traffic incident with moderate-to-high impact severity.`;
  }
  if (conf >= 50) {
    return `A potential incident involving ${objectStr} was detected. The AI observed unusual motion patterns that suggest a possible collision or near-miss event.`;
  }
  return `Minor anomaly involving ${objectStr} was flagged. The motion patterns show a deviation from normal traffic flow, but the event may not constitute a full collision.`;
}

function getIncidentType(marker) {
  const objects = marker.objects || ['vehicle'];
  if (objects.length >= 2) return 'Multi-vehicle collision';
  if (objects.includes('pedestrian')) return 'Pedestrian involved incident';
  if (objects.includes('bicycle') || objects.includes('bike')) return 'Cyclist involved incident';
  if (objects.includes('truck') || objects.includes('bus')) return 'Heavy vehicle collision';
  return 'Vehicle collision';
}

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getRecommendations(markers) {
  const recs = [];
  const maxConf = Math.max(...markers.map(m => m.confidence));
  
  if (maxConf >= 85) {
    recs.push({ icon: '🚨', text: 'Critical incident detected — alert emergency response teams immediately.' });
    recs.push({ icon: '📹', text: 'Preserve this footage as potential evidence for investigation.' });
  }
  if (maxConf >= 70) {
    recs.push({ icon: '🔍', text: 'Review the flagged frames manually to confirm the incident.' });
    recs.push({ icon: '📋', text: 'File an incident report with the detected timestamps.' });
  }
  if (markers.length > 1) {
    recs.push({ icon: '⚠️', text: `Multiple incidents (${markers.length}) detected — this area may require increased surveillance.` });
  }
  recs.push({ icon: '💾', text: 'Save the annotated video for records and future reference.' });
  recs.push({ icon: '📊', text: 'Cross-reference with nearby camera feeds for additional angles.' });
  return recs;
}

export default function VideoAnalysisPage() {
  const { isDark } = useTheme();
  const { socket } = useSocket();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [expandedIncident, setExpandedIncident] = useState(null);
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!socket) return;
    const handleFrame = (data) => setLiveFrame(data);
    socket.on('video_frame', handleFrame);
    return () => socket.off('video_frame', handleFrame);
  }, [socket]);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setVideoUrl(URL.createObjectURL(acceptedFiles[0]));
      setResult(null);
      setExpandedIncident(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/mp4': ['.mp4'], 'video/avi': ['.avi'], 'video/x-msvideo': ['.avi'] },
    maxFiles: 1
  });

  const handleAnalyze = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('video', file);
      const uploadRes = await api.post('/videos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total))
      });

      if (uploadRes.data.path) {
        setVideoUrl(getMediaUrl(`${uploadRes.data.path}?t=${Date.now()}`));
      }

      setUploading(false);
      setProcessing(true);

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.warn("Video auto-play suppressed:", e));
      }

      const filename = uploadRes.data.filename;
      
      const token = localStorage.getItem('crashsense_token');
      const response = await fetch(`${api.defaults.baseURL}/videos/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filename })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop(); // Keep incomplete chunk

          for (const part of parts) {
            if (part.startsWith('data: ')) {
              try {
                const data = JSON.parse(part.substring(6));
                
                if (data.error) {
                  throw new Error(data.error);
                }
                
                if (data.status === 're-encoding') {
                   // Optional: set a specific 're-encoding' state if desired
                   console.log("AI finished, now re-encoding video...");
                }
                
                if (data.success) {
                  const realMarkers = data.markers || [];
                  const annotatedUrl = data.annotatedVideoUrl;
                  
                  if (annotatedUrl) {
                      setVideoUrl(getMediaUrl(`${annotatedUrl}?t=${Date.now()}`));
                  }
                  
                  if (videoRef.current) {
                    setTimeout(() => videoRef.current?.play().catch(e => console.warn(e)), 100);
                  }
                  
                  const dur = videoRef.current?.duration || 60;
            
                  setResult({ 
                    markers: realMarkers, 
                    totalFrames: dur * 30, 
                    processedAt: new Date().toISOString(),
                    fileName: file.name,
                    fileSize: file.size,
                    duration: dur
                  });
            
                  // Auto-expand first incident
                  if (realMarkers.length > 0) setExpandedIncident(0);
                  done = true; // Exit loop
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e, part);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("AI Analysis Error:", err);
      const errMsg = err.response?.data?.error || err.response?.data?.details || err.message || 'Analysis failed. Please try again.';
      setError(errMsg);
    } finally {
      setUploading(false);
      setProcessing(false);
      setLiveFrame(null);
    }
  };

  const seekTo = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const cardClass = `rounded-2xl p-6 border ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`;

  // Compute overall summary from result
  const isAccident = !!(result && result.markers && result.markers.length > 0);
  const overallSeverity = isAccident 
    ? getSeverity(Math.max(...result.markers.map(m => m.confidence))) 
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            <Video className="w-8 h-8 text-primary" /> Offline Video Analysis
          </h1>
          <p className="text-dark-muted text-[11px] md:text-sm mt-1">Upload recorded traffic footage for AI accident detection</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div className={cardClass}>
          <div {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              isDragActive ? 'border-primary bg-primary/5' : isDark ? 'border-dark-border hover:border-primary/50' : 'border-light-border hover:border-primary/50'
            }`}>
            <input {...getInputProps()} />
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-primary' : 'text-dark-muted'}`} />
            <p className="font-semibold mb-1">{isDragActive ? 'Drop the video here' : 'Drag & drop a video file'}</p>
            <p className="text-sm text-dark-muted">or click to browse • MP4, AVI supported</p>
          </div>

          {file && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-dark-section' : 'bg-gray-50'}`}>
                <Video className="w-5 h-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-dark-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              </div>

              {uploading && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-dark-muted mb-1"><span>Uploading...</span><span>{progress}%</span></div>
                  <div className="h-2 rounded-full bg-dark-section overflow-hidden">
                    <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {processing && (
                <div className="mt-3 flex items-center gap-2 text-sm text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" /> AI processing... Analyzing frames...
                </div>
              )}

              <button onClick={handleAnalyze} disabled={uploading || processing}
                className="mt-4 w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><Play className="w-4 h-4" /> Analyze Video</>}
              </button>
            </motion.div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl p-5 border ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="font-bold text-red-500">Analysis Failed</span>
            </div>
            <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
            <button onClick={() => { setError(null); setFile(null); setResult(null); setVideoUrl(null); }}
              className="mt-3 px-4 py-2 rounded-lg bg-red-500/20 text-red-500 text-sm font-semibold hover:bg-red-500/30 transition-colors"
            >Try Again</button>
          </motion.div>
        )}

        {/* Preview & Results */}
        <div className="space-y-4">
          {videoUrl && (
            <div className={`${cardClass} relative overflow-hidden`}>
              {processing && liveFrame && (
                <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
                   <img src={liveFrame} alt="Live AI Stream" className="w-full h-full object-contain" />
                   <div className="absolute top-4 right-4 bg-danger/90 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-md border border-white/20">
                      <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" /> LIVE AI TRACKING
                   </div>
                </div>
              )}

              <video 
                key={videoUrl} 
                ref={videoRef} 
                src={videoUrl} 
                controls 
                muted
                playsInline
                preload="metadata"
                className="w-full rounded-xl aspect-video bg-black" 
              />
            </div>
          )}

          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cardClass}>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <h3 className="font-bold">Analysis Complete</h3>
                <span className="text-xs text-dark-muted ml-auto font-mono">{result.markers.length} incidents found</span>
              </div>

              {/* Timeline */}
              <div className="relative h-8 bg-dark-section rounded-full mb-4 overflow-hidden">
                {result.markers.map((m, i) => (
                  <button key={i} onClick={() => seekTo(m.time)}
                    className="absolute top-0 h-full w-1 bg-danger hover:w-2 transition-all cursor-pointer group"
                    style={{ left: `${(m.time / (result.duration || 60)) * 100}%` }}>
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg bg-dark-card border border-dark-border text-xs whitespace-nowrap">
                      {m.time}s • {m.confidence}%
                    </div>
                  </button>
                ))}
              </div>

              {/* Markers list */}
              <div className="space-y-2">
                {result.markers.map((m, i) => (
                  <button key={i} onClick={() => seekTo(m.time)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm text-left transition-colors ${isDark ? 'bg-dark-section hover:bg-white/5' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    <AlertTriangle className="w-4 h-4 text-danger" />
                    <div className="flex-1">
                      <span className="font-medium">Accident detected</span>
                      <span className="text-dark-muted ml-2">• {m.objects.join(', ')}</span>
                    </div>
                    <span className="text-xs font-mono flex items-center gap-1"><Clock className="w-3 h-3" /> {m.time}s</span>
                    <span className="text-xs font-mono text-danger">{m.confidence}%</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          DETAILED ANALYSIS REPORT — shown below after analysis completes
         ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            {/* ── Overall Verdict Banner ── */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-dark-border' : 'border-light-border shadow-sm'}`}>
              <div className={`px-4 md:px-6 py-5 flex flex-col md:flex-row items-center md:items-center gap-4 ${
                isAccident 
                  ? (isDark ? 'bg-gradient-to-r from-red-500/10 via-dark-card to-dark-card' : 'bg-gradient-to-r from-red-50 via-white to-white')
                  : (isDark ? 'bg-gradient-to-r from-green-500/10 via-dark-card to-dark-card' : 'bg-gradient-to-r from-green-50 via-white to-white')
              }`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  isAccident ? 'bg-red-500/15' : 'bg-green-500/15'
                }`}>
                  {isAccident 
                    ? <ShieldAlert className="w-7 h-7 text-red-400" /> 
                    : <CheckCircle2 className="w-7 h-7 text-green-400" />
                  }
                </div>
                <div className="flex-1 text-center md:text-left min-w-0">
                  <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 mb-1">
                    <h2 className="text-xl font-black tracking-tight">
                      {isAccident ? 'Accident Detected' : 'No Accident Detected'}
                    </h2>
                    {overallSeverity && (
                      <span className={`text-[10px] md:text-xs font-bold px-3 py-1 rounded-full ${overallSeverity.color} text-white`}>
                        {overallSeverity.level} Severity
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] md:text-sm text-dark-muted">
                    {isAccident 
                      ? `${result.markers.length} incident${result.markers.length > 1 ? 's' : ''} detected with ${Math.max(...result.markers.map(m => m.confidence))}% confidence.`
                      : 'The AI model did not detect any collision events.'
                    }
                  </p>
                </div>
                <div className="text-center md:text-right shrink-0">
                  <p className="text-[10px] text-dark-muted">Analyzed on</p>
                  <p className="text-xs md:text-sm font-semibold">{new Date(result.processedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* ── Summary Stats Grid ── */}
            {isAccident && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: <AlertTriangle className="w-5 h-5" />, label: 'Incidents Found', value: result.markers.length, color: 'text-red-400' },
                  { icon: <Activity className="w-5 h-5" />, label: 'Peak Confidence', value: `${Math.max(...result.markers.map(m => m.confidence))}%`, color: 'text-orange-400' },
                  { icon: <Clock className="w-5 h-5" />, label: 'First Incident At', value: formatTimestamp(Math.min(...result.markers.map(m => m.time))), color: 'text-blue-400' },
                  { icon: <Eye className="w-5 h-5" />, label: 'Video Duration', value: formatTimestamp(Math.round(result.duration || 60)), color: 'text-purple-400' },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className={`${cardClass} flex flex-col items-center text-center py-5`}
                  >
                    <div className={`${stat.color} mb-2`}>{stat.icon}</div>
                    <p className="text-2xl font-black">{stat.value}</p>
                    <p className="text-xs text-dark-muted mt-1">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── Detailed Incident Breakdown ── */}
            {isAccident && (
              <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`}>
                <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg">Detailed Incident Report</h3>
                </div>

                <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                  {result.markers.map((marker, idx) => {
                    const severity = getSeverity(marker.confidence);
                    const isExpanded = expandedIncident === idx;
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 + idx * 0.15 }}
                      >
                        {/* Incident Header (clickable) */}
                        <button
                          onClick={() => setExpandedIncident(isExpanded ? null : idx)}
                          className={`w-full px-6 py-4 flex items-center gap-4 text-left transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${severity.bgLight}`}>
                            <AlertTriangle className={`w-5 h-5 ${severity.textColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold">Incident #{idx + 1}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severity.color} text-white uppercase tracking-wider`}>
                                {severity.level}
                              </span>
                            </div>
                            <p className="text-xs text-dark-muted">{getIncidentType(marker)}</p>
                          </div>
                          <div className="text-right mr-2">
                            <p className="text-sm font-mono font-bold">{formatTimestamp(marker.time)}</p>
                            <p className="text-xs text-dark-muted">@ {marker.time}s</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-dark-section overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${severity.color}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${marker.confidence}%` }}
                                transition={{ duration: 1, delay: 0.5 }}
                              />
                            </div>
                            <span className={`text-sm font-bold font-mono ${severity.textColor}`}>{marker.confidence}%</span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-dark-muted" /> : <ChevronDown className="w-4 h-4 text-dark-muted" />}
                        </button>

                        {/* Expanded Incident Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              <div className={`mx-6 mb-4 rounded-xl p-5 space-y-4 ${isDark ? 'bg-dark-section/50' : 'bg-gray-50'}`}>
                                {/* How it happened */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Info className="w-4 h-4 text-primary" />
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-primary">How It Happened</h4>
                                  </div>
                                  <p className="text-sm leading-relaxed text-dark-muted">
                                    {getIncidentDescription(marker)}
                                  </p>
                                </div>

                                 {/* Details Grid */}
                                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                   <div className={`rounded-lg p-3 ${isDark ? 'bg-dark-card' : 'bg-white'}`}>
                                     <p className="text-[10px] uppercase tracking-wider text-dark-muted font-bold mb-1">When</p>
                                     <p className="text-sm font-semibold">{formatTimestamp(marker.time)}</p>
                                     <p className="text-xs text-dark-muted">At {marker.time}s</p>
                                   </div>
                                   <div className={`rounded-lg p-3 ${isDark ? 'bg-dark-card' : 'bg-white'}`}>
                                     <p className="text-[10px] uppercase tracking-wider text-dark-muted font-bold mb-1">Objects</p>
                                     <div className="flex flex-wrap gap-1 mt-1">
                                       {(marker.objects || ['vehicle']).map((obj, oi) => (
                                         <span key={oi} className={`inline-flex items-center gap-1 text-[9px] md:text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-primary/10 text-primary' : 'bg-primary/10 text-primary'}`}>
                                           <Car className="w-2.5 h-2.5" /> {obj}
                                         </span>
                                       ))}
                                     </div>
                                   </div>
                                   <div className={`rounded-lg p-3 ${isDark ? 'bg-dark-card' : 'bg-white'}`}>
                                     <p className="text-[10px] uppercase tracking-wider text-dark-muted font-bold mb-1">Confidence</p>
                                     <div className="flex items-end gap-2">
                                       <span className={`text-xl md:text-2xl font-black ${severity.textColor}`}>{marker.confidence}%</span>
                                     </div>
                                   </div>
                                 </div>

                                {/* Jump to timestamp */}
                                <button
                                  onClick={() => seekTo(marker.time)}
                                  className="w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm transition-all flex items-center justify-center gap-2"
                                >
                                  <Play className="w-4 h-4" /> Jump to {formatTimestamp(marker.time)} in Video
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Recommendations ── */}
            {isAccident && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`}
              >
                <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg">Recommendations</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {getRecommendations(result.markers).map((rec, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + i * 0.08 }}
                        className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-dark-section' : 'bg-gray-50'}`}
                      >
                        <span className="text-lg shrink-0 mt-0.5">{rec.icon}</span>
                        <p className="text-sm text-dark-muted leading-relaxed">{rec.text}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── File & Processing Metadata ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className={`rounded-2xl px-6 py-4 border flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] md:text-xs text-dark-muted ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`}
            >
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 md:gap-4">
                <span>📁 {result.fileName}</span>
                <span className="hidden sm:inline">•</span>
                <span>{(result.fileSize / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 md:gap-4">
                <span>{new Date(result.processedAt).toLocaleString()}</span>
                <span className="hidden sm:inline">•</span>
                <span>CrashSense v2.0</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
