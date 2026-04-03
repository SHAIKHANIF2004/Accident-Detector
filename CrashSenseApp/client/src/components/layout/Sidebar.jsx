import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  LayoutDashboard, Camera, Video, FileText, AlertTriangle,
  Settings, Users, MonitorPlay, Shield, ChevronLeft, ChevronRight,
  History
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Command Center', roles: ['Admin', 'Operator'] },
  { path: '/dashboard/live', icon: MonitorPlay, label: 'Live Monitor', roles: ['Admin', 'Operator'] },
  { path: '/dashboard/analysis', icon: Video, label: 'Video Analysis', roles: ['Admin', 'Operator'] },
  { path: '/dashboard/analysis/history', icon: History, label: 'Analysis History', roles: ['Admin', 'Operator'] },
  { path: '/dashboard/incidents', icon: AlertTriangle, label: 'Incident Logs', roles: ['Admin', 'Operator'] },
  { path: '/dashboard/cameras', icon: Camera, label: 'Camera Mgmt', roles: ['Admin'] },
  { path: '/dashboard/users', icon: Users, label: 'Create User', roles: ['Admin'] },
  { path: '/dashboard/settings', icon: Settings, label: 'Settings', roles: ['Admin'] },
];

export default function Sidebar({ mobileOpen, setMobileOpen, collapsed, setCollapsed }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    // Close sidebar on navigation change (mobile)
    if (mobileOpen) setMobileOpen(false);
  }, [location.pathname]);

  const filteredItems = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <>
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          width: collapsed ? 72 : 260,
          x: isMobile ? (mobileOpen ? 0 : -260) : 0,
          transition: { type: 'spring', damping: 25, stiffness: 200 }
        }}
        className={`fixed left-0 top-0 h-screen z-50 flex flex-col border-r transition-colors ${
          isDark ? 'bg-dark-section border-dark-border' : 'bg-white border-light-border'
        }`}
      >
      {/* Logo */}
      <Link 
        to="/" 
        className="flex items-center gap-3 px-5 h-16 border-b border-inherit hover:opacity-80 transition-opacity"
      >
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="font-black text-lg tracking-tight gradient-text whitespace-nowrap"
            >
              CrashSense
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-primary/15 text-primary glow-blue'
                  : isDark
                    ? 'text-dark-muted hover:text-white hover:bg-white/5'
                    : 'text-light-muted hover:text-light-text hover:bg-gray-100'
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle (Desktop only) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`mx-3 mb-4 p-2 rounded-xl transition-colors hidden lg:block ${isDark ? 'hover:bg-white/10 text-dark-muted' : 'hover:bg-gray-100 text-light-muted'}`}
      >
        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </motion.aside>
    </>
  );
}
