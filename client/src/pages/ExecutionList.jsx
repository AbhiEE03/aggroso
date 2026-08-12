import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listExecutions } from '../api/executions';

export default function ExecutionList() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchExecutions = async (currentPage, currentStatus) => {
    try {
      setLoading(true);
      setError(null);
      const params = { page: currentPage };
      if (currentStatus) params.status = currentStatus;
      
      const res = await listExecutions(params);
      
      if (res.data.data) {
        setExecutions(res.data.data);
        setTotalPages(res.data.totalPages || 1);
        setPage(res.data.page || 1);
      } else {
        // Fallback for before pagination was fully deployed
        setExecutions(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load executions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions(page, statusFilter);
  }, [page, statusFilter]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Execution History</h1>
          <p className="page-subtitle">View and filter past skill execution runs.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled'].map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
          >
            {s === '' ? 'All Statuses' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          Loading executions…
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-error">{error}</div>
      )}

      {!loading && !error && executions.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-title">No executions found</div>
          <p className="empty-state-desc">Try adjusting your filters.</p>
        </div>
      )}

      {!loading && !error && executions.length > 0 && (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-50)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Skill ID / Version</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Started</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {executions.map(run => (
                  <tr key={run._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge badge-${run.status === 'completed' ? 'published' : run.status === 'failed' ? 'error' : 'draft'}`}>
                        {run.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={`/skills/${run.skillId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                        {run.skillId.slice(-6)}
                      </Link>{' '}
                      <span className="version-chip">v{run.skillVersion || 1}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={`/executions/${run._id}`} className="btn btn-sm btn-ghost">
                        View Trace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
            <button 
              className="btn btn-sm btn-ghost" 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem' }}>
              Page {page} of {totalPages}
            </span>
            <button 
              className="btn btn-sm btn-ghost" 
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </>
  );
}
