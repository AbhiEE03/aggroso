const express = require('express');
const router = express.Router();
const Ajv = require('ajv').default;
const addFormats = require('ajv-formats').default;

const Skill = require('../models/Skill');
const { TOOL_REGISTRY } = require('../constants/toolRegistry');
const { validateJsonSchema, validateAllowedTools } = require('../validators/skillValidator');
const { executeTool } = require('../tools/index');
const { selectToolsFromInstructions } = require('../utils/toolSelector');
const { UnauthorizedToolError, ApprovalRequiredError } = require('../errors/toolErrors');
const { startExecution } = require('../services/executionEngine');

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

/**
 * Helper: runs all pre-save validations (JSON Schema validity + tool registry check).
 * Returns an array of error strings. Empty array = valid.
 *
 * Called before both CREATE and UPDATE so the logic lives in one place.
 */
const validateSkillPayload = (body) => {
  const errors = [];

  // 1. Validate inputSchema
  if (body.inputSchema !== undefined) {
    const { valid, errors: schemaErrors } = validateJsonSchema(body.inputSchema);
    if (!valid) {
      errors.push(...schemaErrors.map((e) => `inputSchema: ${e}`));
    }
  }

  // 2. Validate outputSchema
  if (body.outputSchema !== undefined) {
    const { valid, errors: schemaErrors } = validateJsonSchema(body.outputSchema);
    if (!valid) {
      errors.push(...schemaErrors.map((e) => `outputSchema: ${e}`));
    }
  }

  // 3. Validate allowedTools against the hardcoded registry
  if (body.allowedTools !== undefined) {
    const { valid, unknownTools } = validateAllowedTools(body.allowedTools, TOOL_REGISTRY);
    if (!valid) {
      errors.push(
        `allowedTools contains unknown tool(s): [${unknownTools.join(', ')}]. ` +
          `Valid tools: [${TOOL_REGISTRY.join(', ')}]`
      );
    }
  }

  // 4. Validate approvalRequiredActions are a subset of allowedTools
  if (body.approvalRequiredActions !== undefined && body.allowedTools !== undefined) {
    const notAllowed = body.approvalRequiredActions.filter(
      (a) => !body.allowedTools.includes(a)
    );
    if (notAllowed.length > 0) {
      errors.push(
        `approvalRequiredActions [${notAllowed.join(', ')}] must be a subset of allowedTools`
      );
    }
  }

  return errors;
};

// ─────────────────────────────────────────────
// POST /api/skills — Create a new skill (draft)
// ─────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const validationErrors = validateSkillPayload(req.body);
    if (validationErrors.length > 0) {
      const err = new Error('Skill validation failed');
      err.statusCode = 400;
      err.details = validationErrors;
      return next(err);
    }

    const skill = await Skill.create({
      ...req.body,
      status: 'draft',   // always starts as draft; caller cannot override
      version: 1,
      previousVersionId: req.body.previousVersionId || null,
    });

    return res.status(201).json(skill);
  } catch (err) {
    // Mongoose validation errors (e.g. missing required fields)
    if (err.name === 'ValidationError') {
      const mongoErr = new Error('Skill validation failed');
      mongoErr.statusCode = 400;
      mongoErr.details = Object.values(err.errors).map((e) => e.message);
      return next(mongoErr);
    }
    return next(err);
  }
});

// ─────────────────────────────────────────────
// GET /api/skills — List all skills
// ─────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skills = await Skill.find(filter).sort({ createdAt: -1 });
    return res.json(skills);
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────
// GET /api/skills/:id — Get a single skill by ID
// ─────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      const err = new Error('Skill not found');
      err.statusCode = 404;
      return next(err);
    }
    return res.json(skill);
  } catch (err) {
    if (err.name === 'CastError') {
      const castErr = new Error('Invalid skill ID format');
      castErr.statusCode = 400;
      return next(castErr);
    }
    return next(err);
  }
});

// ─────────────────────────────────────────────
// PUT /api/skills/:id — Edit a skill (draft only)
//
// Design decision: once a skill is published, it is FROZEN.
// Edits must go through the publish flow which creates a new version document.
// This mirrors the "block illegal state transitions" pattern — published is a terminal
// state for that document; only a new draft → new published document can succeed it.
// ─────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      const err = new Error('Skill not found');
      err.statusCode = 404;
      return next(err);
    }

    // Block edits to published skills
    if (skill.status === 'published') {
      const err = new Error(
        'Cannot edit a published skill. Create a new draft version instead.'
      );
      err.statusCode = 409;
      err.details = {
        hint: 'A published skill is frozen. To update it, create a new draft and republish.',
      };
      return next(err);
    }

    // Prevent callers from changing status or version directly via PUT
    const { status, version, previousVersionId, ...updateFields } = req.body;

    const validationErrors = validateSkillPayload(updateFields);
    if (validationErrors.length > 0) {
      const err = new Error('Skill validation failed');
      err.statusCode = 400;
      err.details = validationErrors;
      return next(err);
    }

    Object.assign(skill, updateFields);
    await skill.save();

    return res.json(skill);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const mongoErr = new Error('Skill validation failed');
      mongoErr.statusCode = 400;
      mongoErr.details = Object.values(err.errors).map((e) => e.message);
      return next(mongoErr);
    }
    if (err.name === 'CastError') {
      const castErr = new Error('Invalid skill ID format');
      castErr.statusCode = 400;
      return next(castErr);
    }
    return next(err);
  }
});

// ─────────────────────────────────────────────
// POST /api/skills/:id/publish — Publish a draft skill
//
// Versioning logic (as specified in PROJECT_PLAN section 1):
//   - First publish of a brand-new draft: version stays 1, previousVersionId = null
//   - Republish of a draft that was created from a prior published version:
//     version = previous.version + 1, previousVersionId = previous._id
//
// How republishing works (Phase 4 will surface this more):
//   We do NOT mutate the published document. When the user wants to edit a published skill,
//   they will create a new draft (POST /api/skills with previousVersionId set), edit it,
//   then publish THAT draft. This endpoint just handles the "freeze and increment" step.
// ─────────────────────────────────────────────
router.post('/:id/publish', async (req, res, next) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      const err = new Error('Skill not found');
      err.statusCode = 404;
      return next(err);
    }

    if (skill.status === 'published') {
      const err = new Error('Skill is already published');
      err.statusCode = 409;
      err.details = {
        hint: 'This skill version is already published. Create a new draft to make changes.',
      };
      return next(err);
    }

    // If this draft references a prior version, increment version number
    if (skill.previousVersionId) {
      const priorVersion = await Skill.findById(skill.previousVersionId);
      if (priorVersion) {
        skill.version = priorVersion.version + 1;
      }
    }

    skill.status = 'published';
    await skill.save();

    return res.json(skill);
  } catch (err) {
    if (err.name === 'CastError') {
      const castErr = new Error('Invalid skill ID format');
      castErr.statusCode = 400;
      return next(castErr);
    }
    return next(err);
  }
});

// ─────────────────────────────────────────────
// POST /api/skills/:id/test — Read-only test run
//
// ⚠️  PHASE 2 PLACEHOLDER: tool selection is keyword-based, NOT LLM-driven.
// Phase 3 replaces selectToolsFromInstructions() with a real Gemini planning call.
//
// What this endpoint does:
//   1. Loads the skill
//   2. Validates sampleInput against the skill's inputSchema
//   3. Uses keyword matching on instructions to pick which read-only tool(s) to call
//   4. Calls each tool through executeTool() (which enforces permissions)
//   5. Returns the full trace: tool called, input used, output, any errors
//
// taskCreator is intentionally excluded from test-run mode — it's a write tool
// and requires approval. If a skill only has taskCreator in allowedTools, the
// test-run will return a clear "requires approval" message instead of executing.
// ─────────────────────────────────────────────
router.post('/:id/test', async (req, res, next) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      const err = new Error('Skill not found');
      err.statusCode = 404;
      return next(err);
    }

    const { sampleInput } = req.body;
    if (sampleInput === undefined) {
      const err = new Error('Request body must include "sampleInput"');
      err.statusCode = 400;
      return next(err);
    }

    // Step 1: Validate sampleInput against the skill's inputSchema
    let validate;
    try {
      validate = ajv.compile(skill.inputSchema);
    } catch (compileErr) {
      const err = new Error('Skill inputSchema could not be compiled for validation');
      err.statusCode = 500;
      err.details = compileErr.message;
      return next(err);
    }

    const inputValid = validate(sampleInput);
    if (!inputValid) {
      const err = new Error('sampleInput does not match the skill\'s inputSchema');
      err.statusCode = 400;
      err.details = validate.errors.map((e) => `${e.instancePath} ${e.message}`.trim());
      return next(err);
    }

    // Step 2: Select tools to call (PLACEHOLDER — Phase 3 replaces this)
    const toolsToCall = selectToolsFromInstructions(skill.instructions, skill.allowedTools);

    // Step 3: Execute each tool, collecting results
    const toolResults = [];

    for (const toolName of toolsToCall) {
      const stepResult = { tool: toolName, input: sampleInput, output: null, error: null, status: 'success' };

      try {
        // isApproved is always false in test-run mode
        // taskCreator will throw ApprovalRequiredError here
        const { output, error } = await executeTool(toolName, sampleInput, skill, { isApproved: false });
        stepResult.output = output;
        stepResult.error = error;
        if (error) stepResult.status = 'tool_error';
      } catch (toolErr) {
        if (toolErr instanceof ApprovalRequiredError) {
          stepResult.status = 'approval_required';
          stepResult.error = toolErr.message;
        } else if (toolErr instanceof UnauthorizedToolError) {
          stepResult.status = 'unauthorized';
          stepResult.error = toolErr.message;
        } else {
          stepResult.status = 'error';
          stepResult.error = toolErr.message;
        }
      }

      toolResults.push(stepResult);
    }

    // Also surface any taskCreator entries as "approval required" if it's in allowedTools
    // but wasn't selected by the keyword matcher (since we exclude it from selection)
    if (skill.allowedTools.includes('taskCreator') && !toolsToCall.includes('taskCreator')) {
      toolResults.push({
        tool: 'taskCreator',
        input: null,
        output: null,
        error: 'taskCreator is a write tool — it requires human approval and cannot run in test mode.',
        status: 'approval_required',
      });
    }

    return res.json({
      skillId: skill._id,
      skillName: skill.name,
      sampleInput,
      toolSelectionMethod: 'keyword_placeholder_phase2',
      toolsSelected: toolsToCall,
      results: toolResults,
      warning: 'Tool selection in this response uses keyword matching, NOT real LLM planning. Phase 3 replaces this.',
    });
  } catch (err) {
    if (err.name === 'CastError') {
      const castErr = new Error('Invalid skill ID format');
      castErr.statusCode = 400;
      return next(castErr);
    }
    return next(err);
  }
});

// ─────────────────────────────────────────────
// POST /api/skills/:id/execute — Real agent execution (Phase 3)
//
// Unlike /test (keyword-based, read-only), this runs the REAL Gemini planning
// loop and executes tools according to the model's structured plan.
//
// Requirements:
//   - skill must be PUBLISHED (cannot execute a draft)
//   - body must include "input" matching the skill's inputSchema
//   - write tools in approvalRequiredActions will pause the run
// ─────────────────────────────────────────────
router.post('/:id/execute', async (req, res, next) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      const err = new Error('Skill not found');
      err.statusCode = 404;
      return next(err);
    }

    // Only published skills can be executed
    if (skill.status !== 'published') {
      const err = new Error(
        `Only published skills can be executed. This skill is in "${skill.status}" status.`
      );
      err.statusCode = 409;
      return next(err);
    }

    const { input } = req.body;
    if (input === undefined) {
      const err = new Error('Request body must include "input"');
      err.statusCode = 400;
      return next(err);
    }

    // Validate input against the skill's inputSchema
    let validate;
    try {
      validate = ajv.compile(skill.inputSchema);
    } catch (compileErr) {
      const err = new Error('Skill inputSchema could not be compiled');
      err.statusCode = 500;
      return next(err);
    }

    const inputValid = validate(input);
    if (!inputValid) {
      const err = new Error('input does not match the skill\'s inputSchema');
      err.statusCode = 400;
      err.details = validate.errors.map((e) => `${e.instancePath} ${e.message}`.trim());
      return next(err);
    }

    // Start the execution — returns immediately with the run in its current state
    // (may be 'running', 'awaiting_approval', 'completed', or 'failed')
    const run = await startExecution(skill, input);

    // 202 Accepted if awaiting approval, 200 if completed or failed synchronously
    const statusCode = run.status === 'awaiting_approval' ? 202 : 200;
    return res.status(statusCode).json(run);
  } catch (err) {
    if (err.name === 'CastError') {
      const castErr = new Error('Invalid skill ID format');
      castErr.statusCode = 400;
      return next(castErr);
    }
    return next(err);
  }
});

module.exports = router;
