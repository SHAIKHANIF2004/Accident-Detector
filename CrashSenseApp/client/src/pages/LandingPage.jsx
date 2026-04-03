import { Shield, Camera, Brain, Bell, BarChart3, Zap, ChevronDown, ChevronRight, MonitorPlay, Globe } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const features = [
  { icon: Camera, title: 'Multi-Camera Monitoring', desc: 'Monitor multiple traffic cameras simultaneously with real-time video feeds.' },
  { icon: Brain, title: 'AI Accident Detection', desc: 'YOLO + LSTM deep learning pipeline detects accidents with high accuracy.' },
  { icon: Bell, title: 'Instant Alerts', desc: 'Real-time WebSocket alerts when accidents are detected above threshold.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Comprehensive incident analytics with trends and confidence scores.' },
  { icon: Zap, title: 'Fast Response', desc: 'Sub-second detection enables rapid emergency response coordination.' },
  { icon: Globe, title: 'Smart City Ready', desc: 'Scalable architecture designed for city-wide traffic monitoring.' },
];

const faqs = [
  { q: 'What is AI Accident Detection System?', a: 'CrashSense is an AI-powered smart-city traffic monitoring platform. It uses deep learning models (YOLOv8 for detection, LSTM for prediction) to analyze traffic camera feeds and detect accidents in real-time.' },
  { q: 'How does the system detect accidents?', a: 'The pipeline uses YOLOv8 for vehicle detection and an LSTM neural network that analyzes movement patterns over 30 frames to identify collisions with high confidence.' },
  { q: 'Can the system connect to real CCTV cameras?', a: 'Yes! The system supports RTSP and HTTP video streams. For this demonstration, we use simulated high-quality traffic recordings.' },
  { q: 'What happens after an accident is detected?', a: 'The system triggers a visual alert, plays an alarm, logs the incident, and notifies all connected operators instantly via WebSockets.' },
  { q: 'Can users upload videos for analysis?', a: 'Yes! Our Offline Analysis feature allows you to upload recorded footage to generate detailed reports and timelines.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [openFaq, setOpenFaq] = useState(null);

  const cardBg = isDark ? 'glass-card' : 'glass-card-light';
  const borderClass = isDark ? 'border-dark-border' : 'border-light-border';
  const sectionBg = isDark ? 'bg-dark-section' : 'bg-white';
  const innerCardBg = isDark ? 'bg-dark-card' : 'bg-gray-50';

  return (
    <div className={`min-h-screen overflow-hidden transition-colors ${isDark ? 'bg-dark-bg text-dark-text' : 'bg-light-bg text-light-text'}`}>
      {/* Particles */}
      <div className="particles-bg">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            width: `${Math.random() * 4 + 2}px`, height: `${Math.random() * 4 + 2}px`,
            '--duration': `${Math.random() * 8 + 4}s`, '--delay': `${Math.random() * 4}s`,
            opacity: isDark ? 0.15 : 0.05
          }} />
        ))}
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 md:px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20"><Shield className="w-5 h-5 md:w-6 md:h-6 text-white" /></div>
          <span className="font-black text-xl md:text-2xl tracking-tight gradient-text">CrashSense</span>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          {user ? (
            <Link to="/dashboard" className="px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold bg-primary hover:bg-primary-hover text-white transition-all glow-blue flex items-center gap-2">
              <MonitorPlay className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Dashboard</span>
            </Link>
          ) : (
            <>
              <Link to="/login" className={`text-xs md:text-sm transition-colors ${isDark ? 'text-dark-muted hover:text-white' : 'text-light-muted hover:text-primary'}`}>Login</Link>
              <Link to="/login" className="px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold bg-primary hover:bg-primary-hover text-white transition-all glow-blue">
                <span className="hidden xs:inline">Start Monitoring</span>
                <span className="xs:hidden">Start</span>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 md:py-2 rounded-full border text-[10px] md:text-sm font-medium mb-6 md:mb-8 transition-colors ${
            isDark ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-primary/5 border-primary/20 text-primary'
          }`}>
            <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" /> AI-Powered Traffic Safety
          </div>
          <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-tight mb-4 md:mb-6">
            Real-Time AI<br /><span className="gradient-text">Accident Detection</span><br /><span className="text-3xl md:text-7xl">for Smart Cities</span>
          </h1>
          <p className={`text-sm md:text-xl max-w-2xl mx-auto mb-8 md:mb-10 font-light leading-relaxed px-4 transition-colors ${isDark ? 'text-dark-muted' : 'text-light-muted'}`}>
            Advanced deep learning pipeline monitoring traffic cameras 24/7, detecting accidents in milliseconds, and alerting operators instantly.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 justify-center px-4">
            {user ? (
              <Link to="/dashboard" className="w-full sm:w-auto px-8 py-3.5 md:py-4 rounded-2xl text-base md:text-lg font-bold bg-primary hover:bg-primary-hover text-white transition-all glow-blue flex items-center justify-center gap-2">
                <MonitorPlay className="w-5 h-5" /> Enter Command Center
              </Link>
            ) : (
              <>
                <Link to="/login"
                  className="w-full sm:w-auto px-8 py-3.5 md:py-4 rounded-2xl text-base md:text-lg font-bold bg-primary hover:bg-primary-hover text-white transition-all glow-blue flex items-center justify-center gap-2">
                  <MonitorPlay className="w-5 h-5" /> Start Monitoring
                </Link>
                <Link to="/signup" className={`w-full sm:w-auto px-8 py-3.5 md:py-4 rounded-2xl text-base md:text-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-gray-100 hover:bg-gray-200 text-light-text'
                }`}>
                  Create Account <ChevronRight className="w-5 h-5" />
                </Link>
              </>
            )}
          </div>
        </motion.div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
          className={`mt-20 p-2 max-w-5xl mx-auto ${cardBg}`}
        >
          <div className={`rounded-xl p-4 md:p-6 border transition-colors ${sectionBg} ${borderClass}`}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
              {[
                { label: 'Total Cameras', val: '12', color: 'text-primary' },
                { label: 'Online', val: '10', color: 'text-success' },
                { label: 'Accidents Today', val: '3', color: 'text-danger' },
                { label: 'Active Alerts', val: '2', color: 'text-warning' },
              ].map((m, i) => (
                <div key={i} className={`rounded-xl p-3 md:p-4 border transition-colors ${innerCardBg} ${borderClass}`}>
                  <p className="text-[10px] text-dark-muted uppercase tracking-widest">{m.label}</p>
                  <p className={`text-xl md:text-3xl font-mono font-bold mt-1 ${m.color}`}>{m.val}</p>
                </div>
              ))}
            </div>
            <div className={`h-28 md:h-40 rounded-xl border flex items-center justify-center text-[10px] md:text-sm transition-colors ${innerCardBg} ${borderClass} ${isDark ? 'text-dark-muted' : 'text-light-muted'}`}>
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Live analytics visualization
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-24">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          whileInView={{ opacity: 1, scale: 1 }} 
          viewport={{ once: true, margin: '-100px' }} 
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Powerful <span className="gradient-text">Features</span></h2>
          <p className={`mt-4 text-lg font-light max-w-2xl mx-auto transition-colors ${isDark ? 'text-dark-muted' : 'text-light-muted'}`}>Everything you need for intelligent traffic monitoring, powered by state-of-the-art neural networks.</p>
        </motion.div>
        
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.1, delayChildren: 0.2 }
            }
          }}
        >
          {features.map((f, i) => (
            <motion.div 
              key={i} 
              variants={{
                hidden: { opacity: 0, y: 30, scale: 0.95 },
                show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 20 } }
              }}
              className={`${cardBg} p-6 md:p-8 hover:glow-primary transition-all duration-500 group cursor-default border group-hover:-translate-y-2 ${isDark ? 'border-white/5 hover:bg-white/[0.04]' : 'border-black/5 hover:bg-white shadow-sm hover:shadow-xl'}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-all group-hover:rotate-6 group-hover:scale-110 shadow-lg shadow-primary/5">
                <f.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-black mb-3 group-hover:text-primary transition-colors">{f.title}</h3>
              <p className={`text-sm leading-relaxed font-light transition-colors ${isDark ? 'text-dark-muted group-hover:text-white/70' : 'text-light-muted group-hover:text-light-text'}`}>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Architecture Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-24">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tighter">System <span className="gradient-text">Architecture</span></h2>
        </motion.div>
        <div className={`${cardBg} p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 shadow-sm`}>
          {[
            { title: 'React Frontend', desc: 'Vite + Tailwind CSS v4\nFramer Motion animations\nRecharts analytics\nSocket.IO real-time', color: 'from-primary to-accent' },
            { title: 'Node.js Backend', desc: 'Express REST API\nMongoDB + Mongoose\nJWT Authentication\nWebSocket broadcasts', color: 'from-success to-emerald-600' },
            { title: 'Python AI Service', desc: 'FastAPI microservice\nYOLOv8 detection\nLSTM prediction\nReal-time simulation', color: 'from-warning to-orange-600' },
          ].map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <div className={`w-14 h-14 md:w-16 md:h-16 mx-auto rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center mb-4 text-white text-xl md:text-2xl font-bold italic shadow-lg`}>{i + 1}</div>
              <h3 className="text-lg md:text-xl font-bold mb-3">{a.title}</h3>
              {a.desc.split('\n').map((line, j) => <p key={j} className={`text-xs md:text-sm transition-colors ${isDark ? 'text-dark-muted' : 'text-light-muted'}`}>{line}</p>)}
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 max-w-4xl mx-auto px-8 py-24">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tighter">Common <span className="gradient-text">Questions</span></h2>
          <p className={`mt-4 text-lg transition-colors ${isDark ? 'text-dark-muted' : 'text-light-muted'}`}>Everything you need to know about CrashSense</p>
        </motion.div>

        <div className="space-y-4">
           {faqs.map((faq, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                transition={{ delay: i * 0.1 }}
                className={`${cardBg} overflow-hidden transition-all duration-300 ${openFaq === i ? `ring-1 ring-primary/50 ${isDark ? 'bg-white/[0.03]' : 'bg-white'}` : ''}`}
              >
                 <button 
                   onClick={() => setOpenFaq(openFaq === i ? null : i)}
                   className={`w-full px-5 md:px-6 py-4 md:py-5 flex items-center justify-between text-left transition-colors gap-4 ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}
                 >
                    <span className="font-bold text-base md:text-lg leading-tight">{faq.q}</span>
                    <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.3 }} className="shrink-0">
                       <ChevronDown className={`w-4 h-4 md:w-5 md:h-5 ${openFaq === i ? 'text-primary' : 'text-dark-muted'}`} />
                    </motion.div>
                 </button>
                 <AnimatePresence>
                    {openFaq === i && (
                       <motion.div 
                         initial={{ height: 0, opacity: 0 }} 
                         animate={{ height: 'auto', opacity: 1 }} 
                         exit={{ height: 0, opacity: 0 }}
                         className="overflow-hidden"
                       >
                          <div className={`px-6 pb-6 pt-2 leading-relaxed border-t mt-2 pt-4 transition-colors ${isDark ? 'text-dark-muted border-white/[0.05]' : 'text-light-muted border-black/[0.05]'}`}>
                             {faq.a}
                          </div>
                       </motion.div>
                    )}
                 </AnimatePresence>
              </motion.div>
           ))}
        </div>
      </section>

      {/* Footer */}
      <footer className={`relative z-10 border-t py-8 text-center text-sm transition-colors ${isDark ? 'border-dark-border text-dark-muted' : 'border-light-border text-light-muted'}`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold gradient-text">CrashSense</span>
        </div>
        <p>AI-Powered Traffic Accident Detection System</p>
        <p className="mt-1">© 2025 CrashSense. College Project Demo.</p>
      </footer>
    </div>
  );
}
