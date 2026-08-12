const mongoose = require('mongoose');

/**
 * ExecutionRun — tracks a single agent execution from planning to completion.
 * Matches the data model from PROJECT_PLAN section 1 exactly.
 *
 * State machine:
 *   planning → running → completed
 *   planning → running → awaiting_approval → running → completed
 *   planning → running → failed
 *   any → cancelled (via cancel endpoint)
 */
const stepSchema = new mongoose.Schema(
  {
    stepNumber: { type: Number, required: true },
    tool: { type: String, required: true },
    toolInput: { type: mongoose.Schema.Types.Mixed },
    toolOutput: { type: mongoose.Schema.Types.Mixed, default: null },
    reasoning: { type: String, default: '' },
    requiresApproval: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ['n/a', 'pending', 'approved', 'rejected'],
      default: 'n/a',
    },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'retried', 'skipped'],
      default: 'pending',
    },
    error: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    idempotencyKey: { type: String, default: null },
  },
  { _id: false }
);

const executionRunSchema = new mongoose.Schema(
  {
    skillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill', required: true },
    skillVersion: { type: Number, required: true },
    input: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['planning', 'awaiting_approval', 'running', 'completed', 'failed', 'cancelled'],
      default: 'planning',
    },
    plan: { type: [String], default: [] },       // model's stated step descriptions
    steps: { type: [stepSchema], default: [] },
    finalOutput: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

executionRunSchema.index({ skillId: 1, status: 1 });
executionRunSchema.index({ createdAt: -1 });

const ExecutionRun = mongoose.model('ExecutionRun', executionRunSchema);
module.exports = ExecutionRun;
