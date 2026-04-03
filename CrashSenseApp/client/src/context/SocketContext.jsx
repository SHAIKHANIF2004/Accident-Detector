import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [detections, setDetections] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const alertsRef = useRef([]);

  useEffect(() => {
    // Resolve backend URL — must match api.js logic exactly
    let backendUrl = import.meta.env.VITE_API_URL;
    if (!backendUrl) {
      // In production on Render: frontend is crash-sense-web, backend is crash-sense-api
      if (typeof window !== 'undefined' && window.location.hostname.includes('crash-sense-web')) {
        backendUrl = 'https://crash-sense-api.onrender.com';
      } else {
        backendUrl = window.location.origin; // Local dev
      }
    }
    
    // Create socket instance — connect to the base server, not /api
    const socketUrl = backendUrl.replace('/api', '');
    console.log('[Socket] Connecting to:', socketUrl);
    const s = io(socketUrl, {
       transports: ['websocket', 'polling'],
       reconnectionAttempts: Infinity,
       reconnectionDelay: 1000,
       reconnectionDelayMax: 5000,
       timeout: 20000,
    });

    s.on('connect', () => {
      console.log('Socket connected successfully');
      setConnected(true);
    });
    s.on('disconnect', () => setConnected(false));

    s.on('detection', (data) => {
      if (data.userId && user && data.userId === user._id) {
        setDetections(prev => ({ ...prev, [data.cameraId]: data }));
      }
    });

    s.on('alert', (data) => {
      if (data.userId && user && data.userId === user._id) {
        alertsRef.current = [data, ...alertsRef.current].slice(0, 50);
        setAlerts([...alertsRef.current]);
      }
    });

    setSocket(s);
    return () => s.disconnect();
  }, [user]);

  const clearAlerts = () => { alertsRef.current = []; setAlerts([]); };

  return (
    <SocketContext.Provider value={{ socket, detections, alerts, connected, clearAlerts }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
