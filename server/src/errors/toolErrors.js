/**
 * Custom error types for the tool execution layer.
 *
 * Using named error classes (vs generic Error) so callers can use instanceof checks.
 * This matters in Phase 3 where the execution loop needs to distinguish between:
 *   - UnauthorizedToolError  → hard stop, never execute
 *   - ApprovalRequiredError  → pause and wait for human approval
 *   - ToolExecutionError     → retry once, then fail
 */

class UnauthorizedToolError extends Error {
  constructor(toolName, skillName) {
    super(
      `Tool "${toolName}" is not in the allowedTools list for skill "${skillName}". ` +
        `Access denied — this check runs server-side regardless of what the model requests.`
    );
    this.name = 'UnauthorizedToolError';
    this.statusCode = 403;
    this.toolName = toolName;
  }
}

class ApprovalRequiredError extends Error {
  constructor(toolName) {
    super(
      `Tool "${toolName}" requires human approval before execution. ` +
        `Execution paused — call the approve endpoint to continue.`
    );
    this.name = 'ApprovalRequiredError';
    this.statusCode = 202; // Accepted but not yet executed
    this.toolName = toolName;
  }
}

class ToolExecutionError extends Error {
  constructor(toolName, cause) {
    super(`Tool "${toolName}" failed: ${cause.message}`);
    this.name = 'ToolExecutionError';
    this.statusCode = 500;
    this.toolName = toolName;
    this.cause = cause;
  }
}

module.exports = { UnauthorizedToolError, ApprovalRequiredError, ToolExecutionError };
