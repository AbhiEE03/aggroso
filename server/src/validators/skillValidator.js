const Ajv = require('ajv').default;
const addFormats = require('ajv-formats').default;

/**
 * AJV instance configured with:
 * - strict: false — allows schemas with properties AJV doesn't recognize (e.g. $schema declarations)
 * - allErrors: true — collect ALL validation errors, not just the first
 */
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

/**
 * Validates that a given value is a structurally valid JSON Schema.
 *
 * Strategy: we use AJV's meta-schema validation — compile the value AS a schema.
 * If AJV can compile it without errors, it's a valid JSON Schema.
 *
 * Alternative considered: ajv.validateSchema() which checks against the meta-schema.
 * We chose compile() because it's stricter — it also catches schemas that validate
 * successfully against the meta-schema but fail to compile (e.g. bad $ref targets).
 *
 * @param {any} schema - The value to validate as a JSON Schema
 * @returns {{ valid: boolean, errors: string[] }}
 */
const validateJsonSchema = (schema) => {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    return {
      valid: false,
      errors: ['Schema must be a plain object (JSON Schema definition)'],
    };
  }

  try {
    // Attempt to compile the schema — this validates its structure
    ajv.compile(schema);
    return { valid: true, errors: [] };
  } catch (err) {
    return {
      valid: false,
      errors: [err.message],
    };
  }
};

/**
 * Validates that all entries in allowedTools exist in the TOOL_REGISTRY.
 *
 * @param {string[]} tools
 * @param {string[]} registry
 * @returns {{ valid: boolean, unknownTools: string[] }}
 */
const validateAllowedTools = (tools, registry) => {
  if (!Array.isArray(tools)) {
    return { valid: false, unknownTools: [] };
  }
  const unknownTools = tools.filter((t) => !registry.includes(t));
  return { valid: unknownTools.length === 0, unknownTools };
};

module.exports = { validateJsonSchema, validateAllowedTools };
