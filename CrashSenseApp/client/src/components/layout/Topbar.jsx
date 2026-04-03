import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { Bell, Sun, Moon, LogOut, Search, Wifi, WifiOff, Menu } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { alerts, connected } = useSocket();
  const [showNotif, setShowNotif] = useState(false);
  const [search, setSearch] = useState('');
  const notifRef = useRef(null);
  const navigate = useNavigate();

  const unread = alerts.filter(a => a.severity === 'Critical' || a.severity === 'High').length;

  useEffect(() => {
    function handleClick(e) { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className={`h-16 border-b sticky top-0 z-40 flex items-center gap-4 px-4 md:px-8 backdrop-blur-md transition-all ${isDark ? 'bg-dark-bg/80 border-dark-border' : 'bg-white/80 border-light-border'}`}>
      {/* Mobile Menu Toggle */}
      <button onClick={onMenuClick} className={`p-2.5 rounded-xl lg:hidden transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-light-text'}`}>
        <Menu className="w-5 h-5" />
      </button>

      {/* Search Bar - More refined with focus/hover effects */}
      <div className="flex max-w-xl w-full">
        <div className={`hidden sm:flex items-center gap-2 group px-4 py-2 rounded-xl w-full border transition-all duration-300 ${isDark ? 'bg-dark-section/50 border-dark-border focus-within:border-primary/50 focus-within:bg-dark-section' : 'bg-gray-50 border-transparent focus-within:border-primary/50 focus-within:bg-white focus-within:shadow-sm'}`}>
          <Search className={`w-4 h-4 transition-colors ${isDark ? 'text-dark-muted group-focus-within:text-primary' : 'text-light-muted group-focus-within:text-primary'}`} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search for incidents, cameras..."
            className="bg-transparent outline-none text-sm w-full placeholder:text-dark-muted/60"
            onKeyDown={e => { if (e.key === 'Enter' && search) navigate(`/dashboard/incidents?search=${search}`); }}
          />
        </div>
      </div>

      <div className="flex-1" /> {/* Spacer to push items to the end */}

      <div className="flex items-center gap-2 md:gap-4">
        {/* Right Side Actions Group */}
        <div className={`hidden md:flex items-center gap-1 p-1 rounded-2xl border ${isDark ? 'bg-dark-section/30 border-dark-border' : 'bg-gray-50/50 border-light-border'}`}>
          {/* Connection */}
          <div className={`flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all ${connected ? 'text-success' : 'text-danger'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
          
          <div className={`w-px h-4 mx-1 ${isDark ? 'bg-dark-border' : 'bg-gray-200'}`} />

          {/* Theme toggle */}
          <button onClick={toggleTheme} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-white/10 text-warning' : 'hover:bg-white text-primary shadow-sm'}`}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button onClick={() => setShowNotif(!showNotif)} className={`p-2 rounded-xl relative transition-all ${showNotif ? (isDark ? 'bg-white/10 text-primary' : 'bg-white text-primary shadow-sm') : (isDark ? 'hover:bg-white/5' : 'hover:bg-white/50')}`}>
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border-2 border-inherit" />
              )}
            </button>
            <AnimatePresence>
              {showNotif && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={`absolute right-0 top-12 w-80 md:w-96 rounded-2xl border shadow-2xl overflow-hidden z-50 ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border'}`}
                >
                  <div className="p-4 border-b border-inherit font-bold text-sm flex justify-between items-center">
                    <span>Notifications</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">{alerts.length} New</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {alerts.slice(0, 10).map((alert, i) => (
                      <div key={i} className={`p-4 border-b border-inherit text-sm cursor-pointer transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                        onClick={() => { navigate(`/dashboard/incidents`); setShowNotif(false); }}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${alert.severity === 'Critical' ? 'bg-danger' : alert.severity === 'High' ? 'bg-warning' : 'bg-primary'}`} />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <span className="font-bold">{alert.cameraName}</span>
                              <span className="text-[10px] font-mono text-dark-muted">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-xs text-dark-muted mt-0.5 line-clamp-1">Detection confidence: {alert.confidence}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {alerts.length === 0 && (
                      <div className="p-8 text-center text-dark-muted bg-dark-section/10">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">You're all caught up!</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* User Profile Section - Sleek Pill Design */}
        <div className={`flex items-center gap-3 p-1 pl-3 rounded-2xl border transition-all hover:shadow-lg ${isDark ? 'bg-dark-card border-dark-border hover:bg-dark-section' : 'bg-white border-light-border hover:shadow-gray-200'}`}>
          <div className="hidden lg:block text-right pr-1">
            <p className="text-xs font-bold truncate max-w-[120px] leading-tight">{user?.name}</p>
            <p className="text-[10px] text-primary font-medium uppercase tracking-tighter opacity-80">{user?.role}</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-black text-xs shadow-lg shadow-primary/20 flex-shrink-0">
            {user?.name?.charAt(0)}
          </div>
          <div className={`w-px h-6 ${isDark ? 'bg-dark-border' : 'bg-gray-100'}`} />
          <button onClick={logout} className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-danger/20 text-dark-muted hover:text-danger' : 'hover:bg-danger/10 text-light-muted hover:text-danger'}`}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
