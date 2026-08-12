import { useState } from 'react';
import { testSkill } from '../api/skills';

const STATUS_STYLES = {
  success: { color: 'var(--accent-green)', label: '✓ Success' },
  approval_required: { color: 'var(--accent-orange)', label: '⏸ Approval Required' },
  unauthorized: { color: 'var(--accent-red)', label: '✗ Unauthorized' },
  tool_error: { color: 'var(--accent-red)', label: '✗ Tool Error' },
  error: { color: 'var(--accent-red)', label: '✗ Error' },
};

/**
 * TestSkillPanel — Phase 2 component
 *
 * Lets users enter JSON sample input, run a read-only test against the skill,
 * and see which tools were called, their inputs/outputs, and any errors.
 *
 * Note displayed to user: tool selection is keyword-based in Phase 2.
 * Phase 3 will replace this with real Gemini-driven execution.
 */
export default function TestSkillPanel({ skill }) {
  const [inputJson, setInputJson] = useState(
    JSON.stringify(buildDefaultInput(skill.inputSchema), null, 2)
  );
  const [jsonError, setJsonError] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [serverError, setServerError] = useState(null);

  const handleRun = async () => {
    setJsonError(null);
    setServerError(null);
    setResult(null);

    // Validate JSON client-side first
    let parsed;
    try {
      parsed = JSON.parse(inputJson);
    } catch {
      setJsonError('Input is not valid JSON');
      return;
    }

    setRunning(true);
    try {
      const res = await testSkill(skill._id, parsed);
      setResult(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (data?.details) {
        setServerError({
          message: data.message,
          details: Array.isArray(data.details) ? data.details : [data.details],
        });
      } else {
        setServerError({ message: data?.message || 'Test run failed', details: [] });
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ marginTop: '32px' }}>
      <div className="detail-section-title" style={{ marginBottom: '16px' }}>
        🧪 Test Run — Read-Only Mode
      </div>

      {/* Phase 2 notice */}
      <div
        className="alert"
        style={{
          background: 'rgba(79,142,247,0.08)',
          borderColor: 'rgba(79,142,247,0.25)',
          color: 'var(--accent-blue)',
          marginBottom: '16px',
        }}
      >
        <div>
          <strong>Phase 2 — Keyword-based tool selection.</strong>{' '}
          Tool calls are determined by keyword matching against the skill's instructions, not by the Gemini agent.
          Real agent execution comes in Phase 3.{' '}
          <strong>taskCreator</strong> is blocked in test mode (write tool — requires approval).
        </div>
      </div>

      {/* Input editor */}
      <div className="form-group">
        <label className="form-label" htmlFor="test-input">
          Sample Input (JSON)
        </label>
        <textarea
          id="test-input"
          className={`form-textarea mono${jsonError ? ' error' : ''}`}
          style={{ minHeight: '120px' }}
          value={inputJson}
          onChange={(e) => {
            setInputJson(e.target.value);
            setJsonError(null);
          }}
        />
        {jsonError && <p className="form-error">{jsonError}</p>}
        <p className="form-hint">
          Must match the skill's inputSchema:{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            {JSON.stringify(skill.inputSchema)}
          </code>
        </p>
      </div>

      <button
        id="run-test-btn"
        className="btn btn-primary"
        onClick={handleRun}
        disabled={running}
      >
        {running ? (
          <>
            <span className="spinner" style={{ width: '14px', height: '14px', display: 'inline-block' }} />
            Running…
          </>
        ) : (
          '▶ Run Test'
        )}
      </button>

      {/* Server validation error */}
      {serverError && (
        <div className="alert alert-error" style={{ marginTop: '16px' }}>
          <div>
            <strong>{serverError.message}</strong>
            {serverError.details.length > 0 && (
              <ul>
                {serverError.details.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: 'var(--text-muted)',
              marginBottom: '12px',
            }}
          >
            Tool Execution Trace
          </div>

          {result.results.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              No tools were selected for this input.
            </p>
          ) : (
            result.results.map((step, i) => {
              const style = STATUS_STYLES[step.status] || STATUS_STYLES.error;
              return (
                <div
                  key={i}
                  className="card"
                  style={{
                    marginBottom: '10px',
                    background: 'var(--bg-secondary)',
                    borderLeft: `3px solid ${style.color}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        className="tool-tag"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                      >
                        {step.tool}
                      </span>
                      <span style={{ fontSize: '12px', color: style.color, fontWeight: '600' }}>
                        {style.label}
                      </span>
                    </div>
                  </div>

                  {step.error && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: step.status === 'approval_required' ? 'var(--accent-orange)' : 'var(--accent-red)',
                        background: step.status === 'approval_required'
                          ? 'rgba(247,159,79,0.08)'
                          : 'var(--accent-red-dim)',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: step.output ? '8px' : '0',
                      }}
                    >
                      {step.error}
                    </div>
                  )}

                  {step.output && (
                    <div>
                      <p
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Output
                      </p>
                      <pre className="code-block">
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Build a default sample input based on the skill's inputSchema.
 * Just generates an empty object with required string fields pre-filled.
 */
function buildDefaultInput(schema) {
  if (!schema || typeof schema !== 'object') return {};
  const result = {};
  const props = schema.properties || {};
  const required = schema.required || [];
  for (const key of required) {
    const prop = props[key] || {};
    if (prop.type === 'string') result[key] = '';
    else if (prop.type === 'number' || prop.type === 'integer') result[key] = 0;
    else if (prop.type === 'boolean') result[key] = false;
    else result[key] = null;
  }
  return result;
}
