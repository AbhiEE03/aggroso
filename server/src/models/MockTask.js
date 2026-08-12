const mongoose = require('mongoose');

/**
 * MockTask — the write-side data model for the taskCreator tool.
 *
 * This represents a "task created by the agent" — in a real system it would
 * write to a project management API. Here we persist it to MongoDB so we can
 * demonstrate idempotency (Phase 3) by checking for duplicate idempotencyKeys.
 */
const mockTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    assignee: { type: String, default: null },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    dueDate: { type: String, default: null },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'done'],
      default: 'todo',
    },
    // For Phase 3 idempotency: store the key to prevent duplicate writes
    idempotencyKey: { type: String, unique: true, sparse: true },
    // Track which execution created this task
    executionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdBySkill: { type: String, default: null },
  },
  { timestamps: true }
);

const MockTask = mongoose.model('MockTask', mockTaskSchema);
module.exports = MockTask;
