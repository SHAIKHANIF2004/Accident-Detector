import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
      {/* Particles */}
      <div className="particles-bg">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            width: `${Math.random() * 3 + 2}px`, height: `${Math.random() * 3 + 2}px`,
            '--duration': `${Math.random() * 6 + 4}s`, '--delay': `${Math.random() * 3}s`
          }} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-card p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center"><Shield className="w-7 h-7 text-white" /></div>
            </Link>
            <h1 className="text-3xl font-black tracking-tight gradient-text">CrashSense</h1>
            <p className="text-dark-muted text-sm mt-2">Sign in to access the control room</p>
          </div>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 mb-6 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-widest text-dark-muted mb-2 block">Email</label>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-card border border-dark-border focus-within:border-primary transition-colors">
                <Mail className="w-4 h-4 text-dark-muted" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="admin@crashsense.com" className="bg-transparent w-full outline-none text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-dark-muted mb-2 block">Password</label>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-card border border-dark-border focus-within:border-primary transition-colors">
                <Lock className="w-4 h-4 text-dark-muted" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••" className="bg-transparent w-full outline-none text-sm" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all glow-blue disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating...</> : 'Sign In'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
