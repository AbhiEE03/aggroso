import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { compareSkillVersions } from '../api/skills';

export default function SkillCompare() {
  const [searchParams] = useSearchParams();
  const fromId = searchParams.get('from');
  const toId = searchParams.get('to');

  const [diffData, setDiffData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fromId || !toId) {
      setError('Both "from" and "to" parameters are required.');
      setLoading(false);
      return;
    }

    const fetchDiff = async () => {
      try {
        setLoading(true);
        const res = await compareSkillVersions(fromId, toId);
        setDiffData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load comparison data');
      } finally {
        setLoading(false);
      }
    };
    fetchDiff();
  }, [fromId, toId]);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" /> Loading comparison…
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!diffData) return null;

  const { diff, from, to } = diffData;
  const changedFields = Object.keys(diff);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Compare Skill Versions</h1>
          <p className="page-subtitle">
            Comparing <Link to={`/skills/${from._id}`}>v{from.version}</Link> to <Link to={`/skills/${to._id}`}>v{to.version}</Link>
          </p>
        </div>
      </div>

      {changedFields.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No differences found between these two versions.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {changedFields.map(field => (
            <div key={field} className="card">
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.125rem' }}>{field}</h3>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, padding: '12px', background: '#ffebee', borderRadius: '4px', border: '1px solid #ffcdd2' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c62828', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Old (v{from.version})
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.875rem' }}>
                    {typeof diff[field].old === 'object' 
                      ? JSON.stringify(diff[field].old, null, 2) 
                      : String(diff[field].old)}
                  </pre>
                </div>
                <div style={{ flex: 1, padding: '12px', background: '#e8f5e9', borderRadius: '4px', border: '1px solid #c8e6c9' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2e7d32', marginBottom: '8px', textTransform: 'uppercase' }}>
                    New (v{to.version})
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.875rem' }}>
                    {typeof diff[field].new === 'object' 
                      ? JSON.stringify(diff[field].new, null, 2) 
                      : String(diff[field].new)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
