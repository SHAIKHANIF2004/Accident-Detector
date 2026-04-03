import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Search, Filter, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import api from '../services/api';

const statusColors = {
  'Pending Review': 'bg-warning/15 text-warning',
  'Confirmed Accident': 'bg-danger/15 text-danger',
  'False Alarm': 'bg-dark-muted/15 text-dark-muted',
};

export default function IncidentLogsPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [incidents, setIncidents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/incidents', { params });
      setIncidents(res.data.incidents);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchIncidents(); }, [page, statusFilter]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchIncidents(); };
  
  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/incidents/${deleteId}`);
      setIncidents(prev => prev.filter(inc => inc._id !== deleteId));
      setTotal(prev => prev - 1);
      setDeleteId(null);
    } catch (err) {
      alert('Failed to delete incident.');
    }
  };

  const cardClass = `rounded-2xl border ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-sm'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-warning" /> Incident Logs
          </h1>
          <p className="text-dark-muted text-[11px] md:text-sm mt-1">Search and manage detected accident records</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <form onSubmit={handleSearch} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1 sm:max-w-md border ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border'}`}>
          <Search className="w-4 h-4 text-dark-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="bg-transparent outline-none text-sm w-full" />
        </form>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
          <Filter className="w-4 h-4 text-dark-muted shrink-0" />
          {['', 'Pending Review', 'Confirmed Accident', 'False Alarm'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === s ? 'bg-primary text-white' : isDark ? 'bg-dark-section text-dark-muted hover:bg-white/10' : 'bg-gray-100 text-light-muted hover:bg-gray-200'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={cardClass + ' overflow-hidden'}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`text-xs uppercase tracking-widest ${isDark ? 'bg-dark-section text-dark-muted' : 'bg-gray-50 text-light-muted'}`}>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Camera</th>
                <th className="px-5 py-3 text-left">Confidence</th>
                <th className="px-5 py-3 text-left">Severity</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc, i) => (
                <motion.tr key={inc._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className={`border-t cursor-pointer transition-colors ${isDark ? 'border-dark-border hover:bg-white/3' : 'border-light-border hover:bg-gray-50'}`}
                  onClick={() => navigate(`/dashboard/incidents/${inc._id}`)}>
                  <td className="px-5 py-3 text-sm font-mono">{new Date(inc.timestamp).toLocaleDateString()} <span className="text-dark-muted">{new Date(inc.timestamp).toLocaleTimeString()}</span></td>
                  <td className="px-5 py-3 text-sm font-medium">{inc.cameraName || inc.cameraId?.name || 'Unknown'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-dark-section overflow-hidden">
                        <div className={`h-full rounded-full ${inc.confidence >= 90 ? 'bg-danger' : inc.confidence >= 80 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${inc.confidence}%` }} />
                      </div>
                      <span className="text-sm font-mono">{inc.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-1 rounded-lg font-medium ${inc.severity === 'Critical' ? 'bg-danger/15 text-danger' : inc.severity === 'High' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'}`}>{inc.severity}</span></td>
                  <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${statusColors[inc.status] || ''}`}>{inc.status}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button className="text-xs text-primary hover:underline">View Details</button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteId(inc._id); }}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-danger/20 text-dark-muted hover:text-danger' : 'hover:bg-danger/10 text-light-muted hover:text-danger'}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {incidents.length === 0 && !loading && (
            <div className="text-center py-16 text-dark-muted"><AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No incidents found</p></div>
          )}
          <p className="text-[10px] text-dark-muted px-5 py-2 sm:hidden border-t border-inherit italic">Scroll right to see more details →</p>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className={`flex items-center justify-between px-5 py-3 border-t ${isDark ? 'border-dark-border' : 'border-light-border'}`}>
            <span className="text-xs text-dark-muted">{total} total incidents</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-mono">{page} / {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-md p-6 rounded-2xl border ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border shadow-2xl'}`}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-danger/15 flex items-center justify-center text-danger">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Confirm Deletion</h3>
                <p className="text-dark-muted text-sm">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm mb-6 opacity-80">Are you sure you want to permanently remove this incident record from the system?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${isDark ? 'bg-dark-section hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>
                Cancel
              </button>
              <button onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-danger text-white font-medium hover:bg-danger/90 transition-colors shadow-lg shadow-danger/20">
                Delete Record
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
