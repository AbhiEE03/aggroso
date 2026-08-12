import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSkill, publishSkill, executeSkill, getSkillVersions } from '../api/skills';
import TestSkillPanel from '../components/TestSkillPanel';
import { buildDefaultInput } from '../utils/schemaHelpers';

export default function SkillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [skill, setSkill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const fetchSkill = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSkill(id);
      setSkill(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Skill not found.');
      } else {
        setError(err.response?.data?.message || 'Failed to load skill');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    try {
      setVersionsLoading(true);
      const res = await getSkillVersions(id);
      setVersions(res.data);
    } catch (err) {
      console.error('Failed to fetch versions', err);
    } finally {
      setVersionsLoading(false);
    }
  };

  useEffect(() => { 
    fetchSkill(); 
    fetchVersions();
  }, [id]);

  const handlePublish = async () => {
    if (!window.confirm('Publish this skill? Published skills cannot be edited.')) return;
    setPublishing(true);
    try {
      await publishSkill(id);
      fetchSkill();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to publish skill');
    } finally {
      setPublishing(false);
    }
  };

  const handleExecute = async (executeId = id, schema = skill.inputSchema) => {
    // Build default input from inputSchema for the quick-launch button
    const defaultInput = buildDefaultInput(schema);
    setExecuting(true);
    try {
      const res = await executeSkill(executeId, defaultInput);
      navigate(`/executions/${res.data._id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start execution');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return <div className="loading-state"><div className="spinner" />Loading skill…</div>;
  }

  if (error) {
    return (
      <div>
        <div className="alert alert-error">{error}</div>
        <Link to="/" className="btn btn-ghost">← Back to Skills</Link>
      </div>
    );
  }

  if (!skill) return null;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>{skill.name}</h1>
            <span className="version-chip">v{skill.version}</span>
            <span className={`badge badge-${skill.status}`}>{skill.status}</span>
          </div>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>{skill.purpose}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          ← Skills
        </button>
      </div>

      {/* Actions — Draft */}
      {skill.status === 'draft' && (
        <div className="actions-row" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', marginBottom: '24px' }}>
          <button
            id="publish-skill-btn"
            className="btn btn-success"
            onClick={handlePublish}
            disabled={publishing}
          >
            {publishing ? 'Publishing…' : '🚀 Publish Skill'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => navigate(`/skills/${id}/edit`)}
          >
            ✏️ Edit Draft
          </button>
        </div>
      )}

      {/* Actions — Published */}
      {skill.status === 'published' && (
        <div className="actions-row" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', marginBottom: '24px' }}>
          <button
            id="execute-skill-btn"
            className="btn btn-primary"
            onClick={() => handleExecute()}
            disabled={executing}
          >
            {executing ? 'Starting…' : '▶ Execute with Gemini'}
          </button>
        </div>
      )}

      {/* Detail card */}
      <div className="card">
        {/* Instructions */}
        <div className="detail-section">
          <div className="detail-section-title">Instructions</div>
          <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
            {skill.instructions}
          </p>
        </div>

        <div className="divider" />

        {/* Schemas */}
        <div className="form-row">
          <div className="detail-section">
            <div className="detail-section-title">Input Schema</div>
            <pre className="code-block">
              {JSON.stringify(skill.inputSchema, null, 2)}
            </pre>
          </div>
          <div className="detail-section">
            <div className="detail-section-title">Output Schema</div>
            <pre className="code-block">
              {JSON.stringify(skill.outputSchema, null, 2)}
            </pre>
          </div>
        </div>

        <div className="divider" />

        {/* Meta */}
        <div className="detail-section">
          <div className="detail-section-title">Configuration</div>
          <div className="detail-field">
            <span className="detail-field-label">Allowed Tools</span>
            <span className="detail-field-value">
              {skill.allowedTools.length === 0
                ? <span style={{ color: 'var(--text-muted)' }}>None</span>
                : <div className="skill-tools">{skill.allowedTools.map((t) => <span key={t} className="tool-tag">{t}</span>)}</div>
              }
            </span>
          </div>
          <div className="detail-field">
            <span className="detail-field-label">Requires Approval</span>
            <span className="detail-field-value">
              {skill.approvalRequiredActions.length === 0
                ? <span style={{ color: 'var(--text-muted)' }}>None</span>
                : <div className="skill-tools">{skill.approvalRequiredActions.map((t) => <span key={t} className="tool-tag" style={{ borderColor: 'var(--accent-orange)', color: 'var(--accent-orange)' }}>{t}</span>)}</div>
              }
            </span>
          </div>
          <div className="detail-field">
            <span className="detail-field-label">Max Steps</span>
            <span className="detail-field-value">{skill.maxSteps}</span>
          </div>
          <div className="detail-field">
            <span className="detail-field-label">Version</span>
            <span className="detail-field-value">{skill.version}</span>
          </div>
          <div className="detail-field">
            <span className="detail-field-label">Created</span>
            <span className="detail-field-value">
              {new Date(skill.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="detail-field">
            <span className="detail-field-label">Last Updated</span>
            <span className="detail-field-value">
              {new Date(skill.updatedAt).toLocaleString()}
            </span>
          </div>
          {skill.previousVersionId && (
            <div className="detail-field">
              <span className="detail-field-label">Previous Version</span>
              <span className="detail-field-value">
                <Link to={`/skills/${skill.previousVersionId}`}>{skill.previousVersionId}</Link>
              </span>
            </div>
          )}
        </div>

        {/* Examples */}
        {skill.examples && skill.examples.length > 0 && (
          <>
            <div className="divider" />
            <div className="detail-section">
              <div className="detail-section-title">Examples ({skill.examples.length})</div>
              {skill.examples.map((ex, i) => (
                <div key={i} className="card" style={{ marginTop: '10px', background: 'var(--bg-secondary)' }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Example {i + 1}
                  </p>
                  <div className="form-row">
                    <div>
                      <p className="form-hint" style={{ marginBottom: '4px' }}>Input</p>
                      <pre className="code-block">{JSON.stringify(ex.input, null, 2)}</pre>
                    </div>
                    <div>
                      <p className="form-hint" style={{ marginBottom: '4px' }}>Output</p>
                      <pre className="code-block">{JSON.stringify(ex.output, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Test Skill Panel */}
      <div className="card" style={{ marginTop: '16px' }}>
        <TestSkillPanel skill={skill} />
      </div>

      {/* Version History Panel */}
      {versions.length > 0 && (
        <div className="card" style={{ marginTop: '16px' }}>
          <h2 className="detail-section-title">Version History</h2>
          {versionsLoading ? (
            <p>Loading versions...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {versions.map((v, idx) => (
                <div key={v._id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="version-chip" style={{ marginRight: '8px' }}>v{v.version}</span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Published {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                    {v._id === skill._id && (
                      <span className="badge badge-published" style={{ marginLeft: '8px' }}>Current</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {v.status === 'published' && v._id !== skill._id && (
                      <button 
                        className="btn btn-sm btn-ghost" 
                        onClick={() => handleExecute(v._id, v.inputSchema)}
                        disabled={executing}
                      >
                        ▶ Rerun
                      </button>
                    )}
                    {idx > 0 && (
                      <Link 
                        to={`/skills/compare?from=${versions[idx - 1]._id}&to=${v._id}`}
                        className="btn btn-sm btn-ghost"
                      >
                        Compare with v{versions[idx - 1].version}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
