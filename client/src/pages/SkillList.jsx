import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSkills, publishSkill } from '../api/skills';

const TOOL_REGISTRY = ['calculator', 'docSearch', 'recordLookup', 'taskCreator'];

export default function SkillList() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  const fetchSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSkills(statusFilter || undefined);
      setSkills(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, [statusFilter]);

  const handlePublish = async (e, skillId) => {
    e.preventDefault(); // prevent navigating to detail
    e.stopPropagation();
    if (!window.confirm('Publish this skill? Published skills cannot be edited.')) return;
    try {
      await publishSkill(skillId);
      fetchSkills();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to publish skill');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Skills</h1>
          <p className="page-subtitle">
            Define agent skills — each skill is a reusable, versioned agent configuration.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/skills/new')}>
          + New Skill
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {['', 'draft', 'published'].map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          Loading skills…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="alert alert-error">{error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && skills.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⚙️</div>
          <div className="empty-state-title">No skills yet</div>
          <p className="empty-state-desc">
            Create your first skill to define what an agent can do, which tools it can use,
            and how it should behave.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/skills/new')}>
            Create your first skill
          </button>
        </div>
      )}

      {/* Skill grid */}
      {!loading && !error && skills.length > 0 && (
        <div className="skill-grid">
          {skills.map((skill) => (
            <Link key={skill._id} to={`/skills/${skill._id}`} className="skill-card">
              <div className="skill-card-header">
                <span className="skill-name">{skill.name}</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="version-chip">v{skill.version}</span>
                  <span className={`badge badge-${skill.status}`}>{skill.status}</span>
                </div>
              </div>

              <p className="skill-purpose">{skill.purpose}</p>

              <div className="skill-tools">
                {skill.allowedTools.length === 0 ? (
                  <span className="tool-tag" style={{ color: 'var(--text-muted)' }}>no tools</span>
                ) : (
                  skill.allowedTools.map((t) => (
                    <span key={t} className="tool-tag">{t}</span>
                  ))
                )}
              </div>

              {skill.status === 'draft' && (
                <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/skills/${skill._id}/edit`);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={(e) => handlePublish(e, skill._id)}
                    >
                      Publish
                    </button>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
