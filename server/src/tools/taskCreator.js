const MockTask = require('../models/MockTask');
const { ApprovalRequiredError } = require('../errors/toolErrors');

/**
 * taskCreator tool — the ONLY write tool in this system.
 *
 * This tool ALWAYS requires human approval before execution.
 * It should NEVER be called directly without going through assertToolAllowed()
 * with isApproved=true.
 *
 * In this file we implement the actual write logic. The approval enforcement
 * lives in assertToolAllowed() — taskCreator itself trusts that the caller
 * has already checked approval.
 *
 * For Phase 2 test-run mode: taskCreator will throw ApprovalRequiredError
 * before doing anything, because test-run mode never sets isApproved=true.
 *
 * Interface: (input, options) => Promise<{ output, error }>
 * options.isApproved (boolean) — set by Phase 3 execution loop after approval
 * options.idempotencyKey (string) — set by Phase 3 to prevent duplicate writes
 */

/**
 * @param {{ title: string, description?: string, assignee?: string, priority?: string, dueDate?: string }} input
 * @param {{ isApproved?: boolean, idempotencyKey?: string, executionId?: string, skillName?: string }} options
 */
const taskCreator = async (input, options = {}) => {
  const { isApproved = false, idempotencyKey = null, executionId = null, skillName = null } = options;

  // ── Approval gate ──────────────────────────
  // If not approved, refuse to execute and surface the reason clearly
  if (!isApproved) {
    throw new ApprovalRequiredError('taskCreator');
  }

  // ── Input validation ────────────────────────
  if (!input?.title || typeof input.title !== 'string' || input.title.trim().length === 0) {
    return { output: null, error: 'taskCreator requires a non-empty "title" field' };
  }

  // ── Idempotency check ──────────────────────
  // Phase 3 passes an idempotencyKey. If a task with this key already exists,
  // return the existing task instead of creating a duplicate.
  if (idempotencyKey) {
    const existing = await MockTask.findOne({ idempotencyKey });
    if (existing) {
      return {
        output: {
          task: existing.toObject(),
          idempotencyKey,
          skippedDuplicate: true,
          message: 'Task already created for this execution step — returning existing result',
        },
        error: null,
      };
    }
  }

  // ── Create the task ─────────────────────────
  try {
    const task = await MockTask.create({
      title: input.title.trim(),
      description: input.description || '',
      assignee: input.assignee || null,
      priority: ['low', 'medium', 'high', 'critical'].includes(input.priority)
        ? input.priority
        : 'medium',
      dueDate: input.dueDate || null,
      status: 'todo',
      idempotencyKey,
      executionId,
      createdBySkill: skillName,
    });

    return {
      output: {
        task: task.toObject(),
        idempotencyKey,
        skippedDuplicate: false,
        message: `Task "${task.title}" created successfully (ID: ${task._id})`,
      },
      error: null,
    };
  } catch (err) {
    // Handle duplicate idempotencyKey race condition
    if (err.code === 11000) {
      const existing = await MockTask.findOne({ idempotencyKey });
      return {
        output: {
          task: existing?.toObject() || null,
          idempotencyKey,
          skippedDuplicate: true,
          message: 'Concurrent duplicate detected — returning existing result',
        },
        error: null,
      };
    }
    return { output: null, error: `Failed to create task: ${err.message}` };
  }
};

module.exports = taskCreator;
