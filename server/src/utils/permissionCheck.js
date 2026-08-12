const { UnauthorizedToolError, ApprovalRequiredError } = require('../errors/toolErrors');

/**
 * assertToolAllowed — the permission gate for every tool call.
 *
 * This MUST be called before any tool is invoked, anywhere in the system.
 * Defense in depth: even if the LLM planning prompt restricts tools,
 * this server-side check runs regardless of what the model requests.
 *
 * If the tool is in the skill's approvalRequiredActions and we're not in
 * an approved execution context, throw ApprovalRequiredError.
 *
 * @param {Object} skill         - The Skill document (Mongoose or plain object)
 * @param {string} toolName      - The tool being requested
 * @param {boolean} isApproved   - Whether this specific tool call has been approved (Phase 3)
 * @throws {UnauthorizedToolError}  if tool not in skill.allowedTools
 * @throws {ApprovalRequiredError}  if tool is in approvalRequiredActions and not approved
 */
const assertToolAllowed = (skill, toolName, isApproved = false) => {
  // Step 1: Is the tool even in the allowed list?
  if (!skill.allowedTools.includes(toolName)) {
    throw new UnauthorizedToolError(toolName, skill.name);
  }

  // Step 2: Does this tool require approval that hasn't been granted?
  const requiresApproval =
    skill.approvalRequiredActions && skill.approvalRequiredActions.includes(toolName);

  if (requiresApproval && !isApproved) {
    throw new ApprovalRequiredError(toolName);
  }
};

module.exports = { assertToolAllowed };
