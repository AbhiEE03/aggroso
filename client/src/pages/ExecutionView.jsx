import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getExecution,
  approveStep,
  rejectStep,
  cancelExecution,
} from '../api/executions';

const STATUS_COLORS = {
  planning:          'var(--accent-blue)',
  running:           'var(--accent-blue)',
  awaiting_approval: 'var(--accent-orange)',
  completed:         'var(--accent-green)',
  failed:            'var(--accent-red)',
  cancelled:         'var(--text-muted)',
};

const STATUS_LABELS = {
  planning:          '🧠 Planning…',
  running:           '⚙️ Running…',
  awaiting_approval: '⏸ Awaiting Approval',
  completed:         '✓ Completed',
  failed:            '✗ Failed',
  cancelled:         '○ Cancelled',
};

const STEP_STATUS_STYLE = {
  pending:  { color: 'var(--text-muted)',    icon: '○' },
  success:  { color: 'var(--accent-green)',  icon: '✓' },
  failed:   { color: 'var(--accent-red)',    icon: '✗' },
  skipped:  { color: 'var(--text-muted)',    icon: '–' },
  retried:  { color: 'var(--accent-orange)', icon: '↺' },
};

export default function ExecutionView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // 'approve-N', 'reject-N', 'cancel'

  const load = useCallback(async () => {
    try {
      const res = await getExecution(id);
      setExecution(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load execution');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    // Poll for live updates while execution is non-terminal
    // Stop polling once completed / failed / cancelled
  }, [load]);

  useEffect(() => {
    if (!execution) return;
    const nonTerminal = ['planning', 'running', 'awaiting_approval'];
    if (!nonTerminal.includes(execution.status)) return;

    const interval = setInterval(load, 2500);
    return () => clearInterval(interval);
  }, [execution, load]);

  const handleApprove = async (stepNumber) => {
    setActionLoading(`approve-${stepNumber}`);
    try {
      const res = await approveStep(id, stepNumber);
      setExecution(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Approval failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (stepNumber) => {
    setActionLoading(`reject-${stepNumber}`);
    try {
      const res = await rejectStep(id, stepNumber);
      setExecution(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Rejection failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this execution? This cannot be undone.')) return;
    setActionLoading('cancel');
    try {
      const res = await cancelExecution(id);
      setExecution(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Cancel failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading execution…</p>
        </div>
      </div>
    );
  }

  if (error && !execution) {
    return (
      <div className="page-container">
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Go Back
        </button>
      </div>
    );
  }

  const pendingApprovalStep = execution?.steps?.find(
    (s) => s.requiresApproval && s.approvalStatus === 'pending' && s.status === 'pending'
  );

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(execution?.status);

  return (
    <div className="page-container" style={{ maxWidth: '760px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Link to={`/skills/${execution.skillId}`} className="back-link">
          ← Back to Skill
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Execution Run</h1>
          <span
            className="status-badge"
            style={{
              background: `${STATUS_COLORS[execution.status]}22`,
              color: STATUS_COLORS[execution.status],
              border: `1px solid ${STATUS_COLORS[execution.status]}44`,
              fontWeight: 700,
              fontSize: '13px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {STATUS_LABELS[execution.status] || execution.status}
          </span>
          {!isTerminal && (
            <button
              className="btn btn-ghost"
              style={{ marginLeft: 'auto', color: 'var(--accent-red)', fontSize: '12px' }}
              onClick={handleCancel}
              disabled={actionLoading === 'cancel'}
            >
              {actionLoading === 'cancel' ? 'Cancelling…' : '✕ Cancel Run'}
            </button>
          )}
        </div>

        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span>ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{execution._id}</code></span>
          <span>Started: {new Date(execution.createdAt).toLocaleString()}</span>
          {execution.completedAt && (
            <span>Completed: {new Date(execution.completedAt).toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="detail-section-title" style={{ marginBottom: '10px' }}>Input</div>
        <pre className="code-block">{JSON.stringify(execution.input, null, 2)}</pre>
      </div>

      {/* Plan */}
      {execution.plan && execution.plan.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="detail-section-title" style={{ marginBottom: '12px' }}>
            🧠 Gemini Plan ({execution.plan.length} step{execution.plan.length !== 1 ? 's' : ''})
          </div>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            {execution.plan.map((step, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Approval banner */}
      {pendingApprovalStep && (
        <div
          className="card"
          style={{
            marginBottom: '16px',
            border: '2px solid var(--accent-orange)',
            background: 'rgba(247,159,79,0.06)',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--accent-orange)', marginBottom: '8px', fontSize: '15px' }}>
            ⏸ Approval Required — Step {pendingApprovalStep.stepNumber}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
            <strong>Tool:</strong>{' '}
            <span className="tool-tag">{pendingApprovalStep.tool}</span>
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
            <strong>Reason:</strong> {pendingApprovalStep.reasoning}
          </p>
          <div style={{ marginTop: '8px' }}>
            <strong style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Will be called with:</strong>
            <pre className="code-block" style={{ marginTop: '6px' }}>
              {JSON.stringify(pendingApprovalStep.toolInput, null, 2)}
            </pre>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button
              id={`approve-step-${pendingApprovalStep.stepNumber}`}
              className="btn btn-primary"
              onClick={() => handleApprove(pendingApprovalStep.stepNumber)}
              disabled={!!actionLoading}
            >
              {actionLoading === `approve-${pendingApprovalStep.stepNumber}` ? 'Approving…' : '✓ Approve & Execute'}
            </button>
            <button
              id={`reject-step-${pendingApprovalStep.stepNumber}`}
              className="btn btn-ghost"
              style={{ color: 'var(--accent-red)' }}
              onClick={() => handleReject(pendingApprovalStep.stepNumber)}
              disabled={!!actionLoading}
            >
              {actionLoading === `reject-${pendingApprovalStep.stepNumber}` ? 'Rejecting…' : '✕ Reject'}
            </button>
          </div>
        </div>
      )}

      {/* Step trace */}
      {execution.steps && execution.steps.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="detail-section-title" style={{ marginBottom: '14px' }}>Step Trace</div>
          {execution.steps.map((step) => {
            const style = STEP_STATUS_STYLE[step.status] || STEP_STATUS_STYLE.pending;
            const isAwaitingApproval = step.requiresApproval && step.approvalStatus === 'pending' && step.status === 'pending';
            return (
              <div
                key={step.stepNumber}
                style={{
                  borderLeft: `3px solid ${isAwaitingApproval ? 'var(--accent-orange)' : style.color}`,
                  paddingLeft: '14px',
                  marginBottom: '16px',
                  opacity: step.status === 'pending' && !isAwaitingApproval ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ color: style.color, fontWeight: 700, fontSize: '16px' }}>{style.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>
                    Step {step.stepNumber}
                  </span>
                  <span className="tool-tag">{step.tool}</span>
                  {step.requiresApproval && (
                    <span
                      style={{
                        fontSize: '10px',
                        background: 'rgba(247,159,79,0.15)',
                        color: 'var(--accent-orange)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {step.approvalStatus === 'approved' ? 'APPROVED' : step.approvalStatus === 'rejected' ? 'REJECTED' : 'NEEDS APPROVAL'}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                  {step.reasoning}
                </p>
                {step.toolInput && (
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Input</span>
                    <pre className="code-block" style={{ marginTop: '4px', fontSize: '11px' }}>
                      {JSON.stringify(step.toolInput, null, 2)}
                    </pre>
                  </div>
                )}
                {step.toolOutput && (
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Output</span>
                    <pre className="code-block" style={{ marginTop: '4px', fontSize: '11px' }}>
                      {JSON.stringify(step.toolOutput, null, 2)}
                    </pre>
                  </div>
                )}
                {step.error && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--accent-red)',
                      background: 'var(--accent-red-dim)',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {step.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Final output */}
      {execution.status === 'completed' && execution.finalOutput && (
        <div className="card" style={{ marginBottom: '16px', border: '1px solid var(--accent-green)44' }}>
          <div className="detail-section-title" style={{ marginBottom: '10px', color: 'var(--accent-green)' }}>
            ✓ Final Output
          </div>
          <pre className="code-block">{JSON.stringify(execution.finalOutput, null, 2)}</pre>
        </div>
      )}

      {/* Failure message */}
      {execution.status === 'failed' && execution.error && (
        <div className="alert alert-error">
          <strong>Execution failed:</strong> {execution.error}
        </div>
      )}

      {/* Audit log */}
      {execution.auditLog && execution.auditLog.length > 0 && (
        <details style={{ marginTop: '16px' }}>
          <summary
            style={{
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--text-muted)',
              padding: '8px 0',
              userSelect: 'none',
            }}
          >
            📋 Audit Log ({execution.auditLog.length} entries)
          </summary>
          <div className="card" style={{ marginTop: '8px' }}>
            {execution.auditLog.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '6px 0',
                  borderBottom: i < execution.auditLog.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span
                  style={{
                    color: entry.actorType === 'user' ? 'var(--accent-orange)' : 'var(--accent-blue)',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  [{entry.actorType}]
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{entry.action}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
