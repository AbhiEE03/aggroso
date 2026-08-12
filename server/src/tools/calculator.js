/**
 * calculator tool — safe arithmetic expression evaluator
 *
 * Design: We use mathjs instead of eval() for two reasons:
 *   1. eval() executes arbitrary JS — a security hole if input is ever user-controlled
 *   2. mathjs has a restricted "math.evaluate()" that only understands math expressions
 *
 * We also apply a regex pre-check to reject obviously non-arithmetic strings
 * before even passing them to mathjs (defense in depth).
 *
 * Interface: all tools follow (input) => { output, error }
 * output and error are never both set; one is always null.
 */

// mathjs is loaded lazily to handle the case where it's not yet installed
let math;
try {
  math = require('mathjs');
} catch {
  math = null;
}

/**
 * @param {{ expression: string }} input
 * @returns {{ output: { result: number, expression: string } | null, error: string | null }}
 */
const calculator = (input) => {
  const expression = input?.expression ?? input?.query ?? String(input);

  if (!expression || typeof expression !== 'string') {
    return { output: null, error: 'Input must have an "expression" field (e.g. { "expression": "2 + 3 * 4" })' };
  }

  const trimmed = expression.trim();

  // Pre-check: only allow characters that can appear in a math expression
  // Allowed: digits, operators, parens, dots, spaces, common math constants and functions names
  const SAFE_PATTERN = /^[0-9\s\+\-\*\/\^\.\(\)%,a-zA-Z_]+$/;
  if (!SAFE_PATTERN.test(trimmed)) {
    return { output: null, error: `Expression contains invalid characters: "${trimmed}"` };
  }

  if (!math) {
    return { output: null, error: 'mathjs is not installed. Run: npm install mathjs' };
  }

  try {
    const result = math.evaluate(trimmed);

    // Reject results that aren't a plain number (e.g. matrices, booleans from comparisons)
    if (typeof result !== 'number' && !math.typeOf(result).includes('number')) {
      return {
        output: null,
        error: `Expression did not produce a numeric result. Got: ${math.typeOf(result)}. Only arithmetic expressions are supported.`,
      };
    }

    return { output: { result: Number(result), expression: trimmed }, error: null };
  } catch (err) {
    return { output: null, error: `Invalid arithmetic expression: ${err.message}` };
  }
};

module.exports = calculator;
