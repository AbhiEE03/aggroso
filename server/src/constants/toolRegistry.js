/**
 * TOOL_REGISTRY — the complete, bounded set of tools this platform supports.
 * This is intentionally hardcoded and NOT extensible at runtime.
 * Adding a tool requires a code change + review, not a UI action.
 *
 * Depth of correctness (permissions, approval, idempotency) matters more than tool count.
 */
const TOOL_REGISTRY = ['calculator', 'docSearch', 'recordLookup', 'taskCreator'];

/**
 * Write tools require human approval before execution.
 * Read-only tools do NOT require approval.
 */
const WRITE_TOOLS = new Set(['taskCreator']);

/**
 * Returns true if the given tool name is a registered write tool.
 */
const isWriteTool = (toolName) => WRITE_TOOLS.has(toolName);

module.exports = { TOOL_REGISTRY, WRITE_TOOLS, isWriteTool };
