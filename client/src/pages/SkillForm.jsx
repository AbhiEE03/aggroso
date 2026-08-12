import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createSkill, updateSkill, getSkill } from '../api/skills';

const TOOL_REGISTRY = ['calculator', 'docSearch', 'recordLookup', 'taskCreator'];

const EMPTY_FORM = {
  name: '',
  purpose: '',
  instructions: '',
  inputSchema: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}',
  outputSchema: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}',
  allowedTools: [],
  approvalRequiredActions: [],
  maxSteps: 10,
  examples: [],
};

/**
 * SkillForm — handles both CREATE (/skills/new) and EDIT (/skills/:id/edit).
 * When editing, we load the existing skill and pre-populate the form.
 * Editing is only allowed for draft skills — the server enforces this too,
 * but we also check client-side to show a helpful message early.
 */
export default function SkillForm() {
  const navigate = useNavigate();
  const { id } = useParams(); // present when editing
  const isEditing = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverErrors, setServerErrors] = useState([]);
  const [isPublished, setIsPublished] = useState(false);

  // Load existing skill data when editing
  useEffect(() => {
    if (!isEditing) return;
    const load = async () => {
      try {
        const res = await getSkill(id);
        const skill = res.data;

        if (skill.status === 'published') {
          setIsPublished(true);
          return;
        }

        setForm({
          name: skill.name,
          purpose: skill.purpose,
          instructions: skill.instructions,
          inputSchema:
            typeof skill.inputSchema === 'string'
              ? skill.inputSchema
              : JSON.stringify(skill.inputSchema, null, 2),
          outputSchema:
            typeof skill.outputSchema === 'string'
              ? skill.outputSchema
              : JSON.stringify(skill.outputSchema, null, 2),
          allowedTools: skill.allowedTools || [],
          approvalRequiredActions: skill.approvalRequiredActions || [],
          maxSteps: skill.maxSteps || 10,
          examples: skill.examples || [],
        });
      } catch (err) {
        setLoadError(err.response?.data?.message || 'Failed to load skill');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEditing]);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleTool = (tool) => {
    setForm((prev) => {
      const has = prev.allowedTools.includes(tool);
      const nextTools = has
        ? prev.allowedTools.filter((t) => t !== tool)
        : [...prev.allowedTools, tool];
      // If we remove a tool from allowedTools, also remove it from approvalRequiredActions
      const nextApproval = prev.approvalRequiredActions.filter((a) =>
        nextTools.includes(a)
      );
      return { ...prev, allowedTools: nextTools, approvalRequiredActions: nextApproval };
    });
  };

  const toggleApproval = (tool) => {
    setForm((prev) => {
      const has = prev.approvalRequiredActions.includes(tool);
      return {
        ...prev,
        approvalRequiredActions: has
          ? prev.approvalRequiredActions.filter((a) => a !== tool)
          : [...prev.approvalRequiredActions, tool],
      };
    });
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.purpose.trim()) errors.purpose = 'Purpose is required';
    if (!form.instructions.trim()) errors.instructions = 'Instructions are required';

    try {
      JSON.parse(form.inputSchema);
    } catch {
      errors.inputSchema = 'Must be valid JSON';
    }
    try {
      JSON.parse(form.outputSchema);
    } catch {
      errors.outputSchema = 'Must be valid JSON';
    }

    if (form.maxSteps < 1 || form.maxSteps > 50) {
      errors.maxSteps = 'Must be between 1 and 50';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerErrors([]);

    if (!validate()) return;

    const payload = {
      ...form,
      inputSchema: JSON.parse(form.inputSchema),
      outputSchema: JSON.parse(form.outputSchema),
      maxSteps: Number(form.maxSteps),
    };

    setSaving(true);
    try {
      const res = isEditing
        ? await updateSkill(id, payload)
        : await createSkill(payload);
      navigate(`/skills/${res.data._id}`);
    } catch (err) {
      const data = err.response?.data;
      if (data?.details) {
        setServerErrors(Array.isArray(data.details) ? data.details : [data.details]);
      } else {
        setServerErrors([data?.message || 'Something went wrong']);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Published skill guard ────────────────────
  if (isPublished) {
    return (
      <div className="card" style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
        <h2 style={{ marginBottom: '8px' }}>Published skills are frozen</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
          This skill is published and cannot be edited directly. To make changes, create a new
          draft version from the skill detail page.
        </p>
        <button className="btn btn-ghost" onClick={() => navigate(`/skills/${id}`)}>
          ← Back to skill
        </button>
      </div>
    );
  }

  if (loadError) {
    return <div className="alert alert-error">{loadError}</div>;
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" /> Loading skill…
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEditing ? 'Edit Skill' : 'New Skill'}</h1>
          <p className="page-subtitle">
            {isEditing
              ? 'Update this draft skill. Publish it when ready.'
              : 'Define a new agent skill. It starts as a draft.'}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      {serverErrors.length > 0 && (
        <div className="alert alert-error">
          <div>
            <strong>Validation failed:</strong>
            <ul>
              {serverErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="card">
          {/* ── Basic info ── */}
          <div className="form-group">
            <label className="form-label" htmlFor="skill-name">
              Name <span className="required">*</span>
            </label>
            <input
              id="skill-name"
              className={`form-input${fieldErrors.name ? ' error' : ''}`}
              type="text"
              placeholder="e.g. Customer Support Classifier"
              value={form.name}
              onChange={set('name')}
              maxLength={100}
            />
            {fieldErrors.name && <p className="form-error">{fieldErrors.name}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="skill-purpose">
              Purpose <span className="required">*</span>
            </label>
            <textarea
              id="skill-purpose"
              className={`form-textarea${fieldErrors.purpose ? ' error' : ''}`}
              placeholder="Describe what this skill does in one or two sentences."
              value={form.purpose}
              onChange={set('purpose')}
              maxLength={500}
            />
            {fieldErrors.purpose && <p className="form-error">{fieldErrors.purpose}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="skill-instructions">
              Instructions <span className="required">*</span>
            </label>
            <textarea
              id="skill-instructions"
              className={`form-textarea${fieldErrors.instructions ? ' error' : ''}`}
              style={{ minHeight: '160px' }}
              placeholder="System prompt fragment. Describe the task, constraints, and expected behavior."
              value={form.instructions}
              onChange={set('instructions')}
            />
            <p className="form-hint">This is injected into the agent's system prompt at execution time.</p>
            {fieldErrors.instructions && <p className="form-error">{fieldErrors.instructions}</p>}
          </div>

          <div className="divider" />

          {/* ── Schemas ── */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="input-schema">
                Input Schema <span className="required">*</span>
              </label>
              <textarea
                id="input-schema"
                className={`form-textarea mono${fieldErrors.inputSchema ? ' error' : ''}`}
                value={form.inputSchema}
                onChange={set('inputSchema')}
              />
              <p className="form-hint">JSON Schema defining the shape of valid input.</p>
              {fieldErrors.inputSchema && <p className="form-error">{fieldErrors.inputSchema}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="output-schema">
                Output Schema <span className="required">*</span>
              </label>
              <textarea
                id="output-schema"
                className={`form-textarea mono${fieldErrors.outputSchema ? ' error' : ''}`}
                value={form.outputSchema}
                onChange={set('outputSchema')}
              />
              <p className="form-hint">JSON Schema defining the shape of expected output.</p>
              {fieldErrors.outputSchema && <p className="form-error">{fieldErrors.outputSchema}</p>}
            </div>
          </div>

          <div className="divider" />

          {/* ── Tools ── */}
          <div className="form-group">
            <label className="form-label">Allowed Tools</label>
            <div className="tool-checkboxes">
              {TOOL_REGISTRY.map((tool) => (
                <label
                  key={tool}
                  className={`tool-checkbox-label${form.allowedTools.includes(tool) ? ' checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={form.allowedTools.includes(tool)}
                    onChange={() => toggleTool(tool)}
                  />
                  {tool}
                </label>
              ))}
            </div>
            <p className="form-hint">Select which tools this skill is permitted to use.</p>
          </div>

          {/* ── Approval required (only for taskCreator) ── */}
          {form.allowedTools.includes('taskCreator') && (
            <div className="form-group">
              <label className="form-label">Require Human Approval Before</label>
              <div className="tool-checkboxes">
                {form.allowedTools.filter((t) => t === 'taskCreator').map((tool) => (
                  <label
                    key={tool}
                    className={`tool-checkbox-label${form.approvalRequiredActions.includes(tool) ? ' checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={form.approvalRequiredActions.includes(tool)}
                      onChange={() => toggleApproval(tool)}
                    />
                    {tool} (write action)
                  </label>
                ))}
              </div>
              <p className="form-hint">
                Write tools checked here will pause execution and wait for your approval before running.
              </p>
            </div>
          )}

          {/* ── Max steps ── */}
          <div className="form-group" style={{ maxWidth: '200px' }}>
            <label className="form-label" htmlFor="max-steps">Max Steps</label>
            <input
              id="max-steps"
              className={`form-input${fieldErrors.maxSteps ? ' error' : ''}`}
              type="number"
              min={1}
              max={50}
              value={form.maxSteps}
              onChange={(e) => setForm((prev) => ({ ...prev, maxSteps: e.target.value }))}
            />
            <p className="form-hint">Maximum agent steps per execution (1–50).</p>
            {fieldErrors.maxSteps && <p className="form-error">{fieldErrors.maxSteps}</p>}
          </div>

          <div className="actions-row">
            <button
              id="save-skill-btn"
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Skill'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
