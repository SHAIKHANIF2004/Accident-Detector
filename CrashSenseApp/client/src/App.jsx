import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import DashboardLayout from './components/layout/DashboardLayout';
import LandingPage from './pages/LandingPage';
import FaqPage from './pages/FaqPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import LiveMonitorPage from './pages/LiveMonitorPage';
import VideoAnalysisPage from './pages/VideoAnalysisPage';
import IncidentLogsPage from './pages/IncidentLogsPage';
import IncidentDetailsPage from './pages/IncidentDetailsPage';
import CameraManagementPage from './pages/CameraManagementPage';
import SettingsPage from './pages/SettingsPage';
import AnalysisHistoryPage from './pages/AnalysisHistoryPage';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-dark-bg">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'Admin') return <Navigate to="/dashboard" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <SignupPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="live" element={<LiveMonitorPage />} />
        <Route path="analysis" element={<VideoAnalysisPage />} />
        <Route path="analysis/history" element={<AnalysisHistoryPage />} />
        <Route path="incidents" element={<IncidentLogsPage />} />
        <Route path="incidents/:id" element={<IncidentDetailsPage />} />
        <Route path="cameras" element={<ProtectedRoute adminOnly><CameraManagementPage /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute adminOnly><SignupPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <AppRoutes />
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
