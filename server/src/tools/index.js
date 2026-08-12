/**
 * Tool registry — exports all 4 tools with a consistent execution interface.
 *
 * All tools follow the same contract:
 *   read-only tools:  (input) => { output, error }          (sync)
 *   write tools:      (input, options) => Promise<{ output, error }> (async, needs approval)
 *
 * The dispatcher below normalizes this into a single async call surface
 * so callers don't need to know which tools are sync vs async.
 */
const calculator = require('./calculator');
const { docSearch } = require('./docSearch');
const { recordLookup } = require('./recordLookup');
const taskCreator = require('./taskCreator');

const TOOLS = {
  calculator,
  docSearch,
  recordLookup,
  taskCreator,
};

/**
 * executeTool — unified dispatcher for all tool calls.
 *
 * Always runs assertToolAllowed BEFORE executing.
 * This is the ONLY place tools should be called from — never call them directly.
 *
 * @param {string} toolName
 * @param {any} input
 * @param {Object} skill        - The Skill document (for permission check)
 * @param {Object} options      - { isApproved, idempotencyKey, executionId, skillName }
 * @returns {Promise<{ output, error }>}
 * @throws {UnauthorizedToolError}  — if tool not in skill.allowedTools
 * @throws {ApprovalRequiredError}  — if write tool called without approval
 */
const { assertToolAllowed } = require('../utils/permissionCheck');

const executeTool = async (toolName, input, skill, options = {}) => {
  // Permission check FIRST — always, no exceptions
  assertToolAllowed(skill, toolName, options.isApproved || false);

  const tool = TOOLS[toolName];
  if (!tool) {
    throw new Error(`Tool "${toolName}" is registered in allowedTools but not implemented. This is a bug.`);
  }

  // Execute — normalize to Promise for consistent async interface
  const result = await Promise.resolve(tool(input, options));
  return result;
};

module.exports = { TOOLS, executeTool };
