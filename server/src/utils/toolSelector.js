/**
 * Keyword-based tool selector — TEMPORARY PLACEHOLDER for Phase 2.
 *
 * ⚠️  THIS IS NOT THE REAL AGENT LOGIC.
 * Phase 3 replaces this with a genuine Gemini-driven planning call that
 * returns a structured JSON plan. This exists only so the /test endpoint
 * has something to execute during Phase 2 development.
 *
 * How it works: scans the skill's instructions text for keywords associated
 * with each tool and returns a list of tool names to call, in order.
 *
 * Limitations (intentional — this is a stand-in):
 *   - Only one call per tool (no repeated calls)
 *   - No reasoning about tool inputs
 *   - No understanding of dependencies between steps
 *   - taskCreator is explicitly excluded (write tool, requires approval)
 */
const selectToolsFromInstructions = (instructions, allowedTools) => {
  const text = instructions.toLowerCase();
  const READ_ONLY_TOOLS = allowedTools.filter((t) => t !== 'taskCreator');

  const KEYWORD_MAP = {
    calculator: ['calculat', 'math', 'arithmetic', 'compute', 'sum', 'multiply', 'divide', 'percent', 'formula'],
    docSearch:  ['search', 'document', 'find', 'lookup', 'knowledge', 'article', 'faq', 'policy', 'doc'],
    recordLookup: ['record', 'customer', 'user', 'invoice', 'task', 'lookup', 'fetch', 'retrieve', 'get'],
  };

  const matched = [];
  for (const tool of READ_ONLY_TOOLS) {
    const keywords = KEYWORD_MAP[tool] || [];
    if (keywords.some((kw) => text.includes(kw))) {
      matched.push(tool);
    }
  }

  // Fallback: if nothing matched but there are allowed read-only tools, call the first one
  if (matched.length === 0 && READ_ONLY_TOOLS.length > 0) {
    matched.push(READ_ONLY_TOOLS[0]);
  }

  return matched;
};

module.exports = { selectToolsFromInstructions };
