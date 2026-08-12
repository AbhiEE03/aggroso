const mongoose = require('mongoose');
const { TOOL_REGISTRY } = require('../constants/toolRegistry');

/**
 * Skill schema — matches the data model in the PROJECT_PLAN exactly.
 *
 * Design note on versioning:
 * When a published skill is edited and republished, we do NOT overwrite the old document.
 * Instead, we create a NEW Skill document with version+1 and previousVersionId pointing at
 * the prior document. This keeps the history chain immutable and queryable.
 *
 * The "current published" version is whichever Skill document has status='published'
 * and is NOT referenced by any other document's previousVersionId — i.e., the head of the chain.
 * (Alternatively we track this with a canonical "latestVersionId" on all docs in the chain
 * — but for Phase 1 we keep it simple: just walk the chain.)
 */
const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      trim: true,
      maxlength: [100, 'Skill name cannot exceed 100 characters'],
    },
    purpose: {
      type: String,
      required: [true, 'Skill purpose is required'],
      trim: true,
      maxlength: [500, 'Purpose cannot exceed 500 characters'],
    },
    inputSchema: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'inputSchema is required'],
    },
    outputSchema: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'outputSchema is required'],
    },
    instructions: {
      type: String,
      required: [true, 'Instructions (system prompt fragment) are required'],
    },
    examples: [
      {
        input: { type: mongoose.Schema.Types.Mixed },
        output: { type: mongoose.Schema.Types.Mixed },
        _id: false,
      },
    ],
    allowedTools: {
      type: [String],
      default: [],
      validate: {
        validator: function (tools) {
          return tools.every((t) => TOOL_REGISTRY.includes(t));
        },
        message: (props) =>
          `allowedTools contains unknown tool(s): ${props.value.filter(
            (t) => !TOOL_REGISTRY.includes(t)
          )}. Valid tools: ${TOOL_REGISTRY.join(', ')}`,
      },
    },
    approvalRequiredActions: {
      type: [String],
      default: [],
      validate: {
        validator: function (actions) {
          return actions.every((a) => TOOL_REGISTRY.includes(a));
        },
        message: (props) =>
          `approvalRequiredActions contains unknown tool(s): ${props.value}`,
      },
    },
    maxSteps: {
      type: Number,
      default: 10,
      min: [1, 'maxSteps must be at least 1'],
      max: [50, 'maxSteps cannot exceed 50'],
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    version: {
      type: Number,
      default: 1,
    },
    previousVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
  }
);

// Index for efficient version chain traversal
skillSchema.index({ previousVersionId: 1 });
skillSchema.index({ status: 1, name: 1 });

const Skill = mongoose.model('Skill', skillSchema);

module.exports = Skill;
