const crypto = require('crypto');
const ExecutionRun = require('../models/ExecutionRun');
const AuditLog = require('../models/AuditLog');
const { generatePlan, synthesizeFinalOutput } = require('./geminiPlanner');
const { executeTool } = require('../tools/index');
const { UnauthorizedToolError, ApprovalRequiredError } = require('../errors/toolErrors');

/**
 * audit — convenience helper to append an AuditLog entry.
 */
const audit = async (executionId, actorType, action, detail = null) => {
  try {
    await AuditLog.create({ executionId, actorType, action, detail });
  } catch {
    // Never let audit logging crash the execution
    console.error('[Audit] Failed to write log entry:', action);
  }
};

/**
 * makeIdempotencyKey — deterministic key per (executionId, stepNumber, toolInput).
 * Same inputs always produce the same key, so re-running an approved step
 * after a crash never creates a duplicate write.
 */
const makeIdempotencyKey = (executionId, stepNumber, toolInput) => {
  const payload = `${executionId}:step${stepNumber}:${JSON.stringify(toolInput)}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * startExecution — Phase 3 core function.
 *
 * Flow:
 *   1. Create an ExecutionRun document in 'planning' state
 *   2. Call Gemini to generate a step plan
 *   3. Run each step through the execution loop
 *      - If a step needs approval → update run to 'awaiting_approval', return early
 *      - If a step is read-only → execute immediately
 *   4. After all steps → synthesize final output, mark 'completed'
 *
 * @returns {Promise<ExecutionRun>} the current state of the run
 */
const startExecution = async (skill, userInput) => {
  // Create the run document
  const run = await ExecutionRun.create({
    skillId: skill._id,
    skillVersion: skill.version,
    input: userInput,
    status: 'planning',
  });

  await audit(run._id, 'system', 'execution_started', { skillId: skill._id, skillName: skill.name });

  try {
    // ── Phase: Planning ─────────────────────────
    const planSteps = await generatePlan(skill, userInput);

    run.plan = planSteps.map((s) => `${s.tool}: ${s.reasoning}`);
    run.steps = planSteps.map((step, i) => ({
      stepNumber: i + 1,
      tool: step.tool,
      toolInput: step.toolInput,
      reasoning: step.reasoning,
      requiresApproval: skill.approvalRequiredActions?.includes(step.tool) || false,
      approvalStatus: skill.approvalRequiredActions?.includes(step.tool) ? 'pending' : 'n/a',
      status: 'pending',
      idempotencyKey: skill.approvalRequiredActions?.includes(step.tool)
        ? makeIdempotencyKey(run._id.toString(), i + 1, step.toolInput)
        : null,
    }));
    run.status = 'running';
    await run.save();

    await audit(run._id, 'system', 'plan_generated', {
      steps: planSteps.map((s) => `${s.tool}: ${s.reasoning}`),
    });

    // ── Phase: Execution loop ────────────────────
    return await continueExecution(run, skill);
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    await run.save();
    await audit(run._id, 'system', 'execution_failed', { error: err.message });
    return run;
  }
};

/**
 * continueExecution — runs pending steps from the current position.
 *
 * Called by:
 *   - startExecution (fresh run)
 *   - approveStep (after user approval, resumes from the approved step)
 *
 * Returns the run in its new state. The caller is responsible for saving
 * the run if it modifies it further.
 */
const continueExecution = async (run, skill) => {
  for (let i = 0; i < run.steps.length; i++) {
    const step = run.steps[i];

    if (step.status !== 'pending') continue; // already done

    // ── Approval gate ─────────────────────────────
    if (step.requiresApproval && step.approvalStatus !== 'approved') {
      // Pause here — the approve endpoint will resume
      run.status = 'awaiting_approval';
      await run.save();
      await audit(run._id, 'system', 'awaiting_approval', {
        stepNumber: step.stepNumber,
        tool: step.tool,
      });
      return run;
    }

    // ── Execute the step ──────────────────────────
    try {
      const isApproved = step.approvalStatus === 'approved';
      const { output, error } = await executeTool(step.tool, step.toolInput, skill, {
        isApproved,
        idempotencyKey: step.idempotencyKey,
        executionId: run._id,
        skillName: skill.name,
      });

      step.toolOutput = output;
      step.status = error ? 'failed' : 'success';
      step.error = error || null;

      await audit(run._id, 'system', 'tool_called', {
        stepNumber: step.stepNumber,
        tool: step.tool,
        input: step.toolInput,
        output,
        error,
      });
    } catch (toolErr) {
      if (toolErr instanceof ApprovalRequiredError) {
        // Shouldn't happen if gate above works — but catch defensively
        run.status = 'awaiting_approval';
        await run.save();
        return run;
      }
      if (toolErr instanceof UnauthorizedToolError) {
        step.status = 'failed';
        step.error = toolErr.message;
        run.status = 'failed';
        run.error = `Unauthorized tool call in step ${step.stepNumber}: ${toolErr.message}`;
        await run.save();
        await audit(run._id, 'system', 'unauthorized_tool', {
          stepNumber: step.stepNumber,
          tool: step.tool,
          error: toolErr.message,
        });
        return run;
      }
      // Other errors: log and continue
      step.status = 'failed';
      step.error = toolErr.message;
      await audit(run._id, 'system', 'step_error', {
        stepNumber: step.stepNumber,
        error: toolErr.message,
      });
    }

    // Mark MongoDB array element as modified (needed for subdoc arrays)
    run.markModified('steps');
    await run.save();
  }

  // ── All steps done: synthesize final output ────
  const successfulSteps = run.steps.filter((s) => s.status === 'success');
  run.finalOutput = await synthesizeFinalOutput(skill, run.input, successfulSteps);
  run.status = 'completed';
  run.completedAt = new Date();
  await run.save();

  await audit(run._id, 'system', 'execution_completed', { finalOutput: run.finalOutput });
  return run;
};

/**
 * approveStep — called by the approve endpoint after user confirms a step.
 *
 * Marks the step as approved, records the approver in the audit log,
 * then resumes the execution loop from that step.
 */
const approveStep = async (run, stepNumber, approvedBy = 'user', skill) => {
  const step = run.steps.find((s) => s.stepNumber === stepNumber);
  if (!step) throw new Error(`Step ${stepNumber} not found`);
  if (step.approvalStatus !== 'pending') {
    throw new Error(`Step ${stepNumber} is not pending approval (status: ${step.approvalStatus})`);
  }

  step.approvalStatus = 'approved';
  step.approvedBy = approvedBy;
  step.approvedAt = new Date();
  run.status = 'running';
  run.markModified('steps');
  await run.save();

  await audit(run._id, 'user', 'approval_granted', { stepNumber, approvedBy });

  return await continueExecution(run, skill);
};

/**
 * rejectStep — marks the step as rejected, sets the run to failed.
 * A rejected step cannot be retried — the user must start a new execution.
 */
const rejectStep = async (run, stepNumber, rejectedBy = 'user') => {
  const step = run.steps.find((s) => s.stepNumber === stepNumber);
  if (!step) throw new Error(`Step ${stepNumber} not found`);
  if (step.approvalStatus !== 'pending') {
    throw new Error(`Step ${stepNumber} is not pending approval (status: ${step.approvalStatus})`);
  }

  step.approvalStatus = 'rejected';
  step.status = 'skipped';
  run.status = 'failed';
  run.error = `Execution rejected by ${rejectedBy} at step ${stepNumber} (${step.tool})`;
  run.markModified('steps');
  await run.save();

  await audit(run._id, 'user', 'approval_rejected', { stepNumber, rejectedBy });
  return run;
};

module.exports = { startExecution, approveStep, rejectStep };
