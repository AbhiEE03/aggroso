const mongoose = require('mongoose');

/**
 * AuditLog — append-only log of every significant event in an execution.
 *
 * actorType: 'system' = automated action, 'user' = human approval/rejection
 * action: descriptive string (e.g. 'plan_generated', 'tool_called', 'approval_granted')
 *
 * Never delete or update audit log entries — only append.
 */
const auditLogSchema = new mongoose.Schema(
  {
    executionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExecutionRun',
      required: true,
    },
    actorType: {
      type: String,
      enum: ['system', 'user'],
      required: true,
    },
    action: { type: String, required: true },
    detail: { type: mongoose.Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  {
    // Disable updatedAt — audit logs are append-only
    timestamps: { createdAt: false, updatedAt: false },
    // Capped collection would be ideal in prod but complicates testing; skip for now
  }
);

auditLogSchema.index({ executionId: 1, timestamp: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
