import { motion } from 'framer-motion';
import { ChevronDown, Shield } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const faqs = [
  { q: 'What is AI Accident Detection System?', a: 'CrashSense is an AI-powered smart-city traffic monitoring platform. It uses deep learning models (YOLOv8 for detection, LSTM for prediction) to analyze traffic camera feeds and detect accidents in real-time, enabling faster emergency response.' },
  { q: 'How does the system detect accidents?', a: 'The detection pipeline works in three stages: 1) YOLOv8 detects vehicles in each frame, 2) DeepSORT tracks vehicle movement across frames, 3) An LSTM neural network analyzes the sequence of vehicle movements over 30 frames to predict accident probability.' },
  { q: 'Can the system connect to real CCTV cameras?', a: 'The architecture supports RTSP and HTTP video streams from IP cameras. For this college demonstration, we simulate live feeds using pre-recorded traffic videos stored locally that loop continuously.' },
  { q: 'What happens after an accident is detected?', a: 'When the AI confidence score exceeds the configured threshold (default 80%), the system: highlights the camera feed with a red border, plays an alarm sound, creates an incident log in the database, and pushes a real-time alert to all connected operators via WebSocket.' },
  { q: 'Can users upload videos for analysis?', a: 'Yes! The Offline Analysis page lets users drag-and-drop recorded traffic videos (.mp4, .avi). The system processes them through the AI pipeline and generates a timeline with markers at detected accident timestamps.' },
  { q: 'Who can access the system?', a: 'The system uses role-based access control with JWT authentication. Admins can manage cameras, create users, and configure AI settings. Operators can monitor live feeds, acknowledge alerts, and export incident reports as PDF.' },
  { q: 'What technology stack is used?', a: 'Frontend: React + Vite + Tailwind CSS v4 + Framer Motion. Backend: Node.js + Express + MongoDB. AI Service: Python FastAPI. Communication: Socket.IO WebSockets for real-time updates.' },
  { q: 'Is this suitable for production use?', a: 'This is designed as a college project demonstration. For production deployment, you would need to integrate real ML models (the Engine code is included), add HTTPS, configure proper authentication, and scale the infrastructure.' },
];

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 md:px-8 py-5 max-w-5xl mx-auto">
        <Link to="/" className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary flex items-center justify-center shrink-0"><Shield className="w-5 h-5 md:w-6 md:h-6 text-white" /></div>
          <span className="font-black text-xl md:text-2xl tracking-tight gradient-text">CrashSense</span>
        </Link>
        <Link to="/login" className="px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold bg-primary hover:bg-primary-hover transition-all">Login</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-8 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10 md:mb-16">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 leading-tight">Frequently Asked<br /><span className="gradient-text">Questions</span></h1>
          <p className="text-dark-muted text-base md:text-lg font-light">Everything you need to know about CrashSense</p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass-card overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-white/5 transition-colors"
              >
                <span className="font-semibold pr-4 text-sm md:text-base">{faq.q}</span>
                <motion.div animate={{ rotate: openIndex === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-5 h-5 text-primary flex-shrink-0" />
                </motion.div>
              </button>
              <motion.div
                initial={false}
                animate={{ height: openIndex === i ? 'auto' : 0, opacity: openIndex === i ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <p className="px-4 md:px-5 pb-4 md:p-5 text-dark-muted leading-relaxed text-xs md:text-sm">{faq.a}</p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
