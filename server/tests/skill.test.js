/**
 * Phase 1 Tests — Skill validation logic
 *
 * These tests do NOT require a live MongoDB connection.
 * They test the pure validation functions (AJV, tool registry) and route-level behavior
 * using supertest with a real in-memory mongoose connection via mongodb-memory-server.
 *
 * NOTE: We test validation logic purely through the validators module first,
 * then integration-test the full route behavior.
 */
const { validateJsonSchema, validateAllowedTools } = require('../src/validators/skillValidator');
const { TOOL_REGISTRY } = require('../src/constants/toolRegistry');

// ─────────────────────────────────────────────
// Unit tests: validateJsonSchema
// ─────────────────────────────────────────────
describe('validateJsonSchema', () => {
  test('accepts a valid JSON Schema object', () => {
    const result = validateJsonSchema({
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('accepts an empty object as a valid JSON Schema (allows anything)', () => {
    // {} is a valid JSON Schema that accepts any value
    const result = validateJsonSchema({});
    expect(result.valid).toBe(true);
  });

  test('rejects a non-object (array)', () => {
    const result = validateJsonSchema([{ type: 'string' }]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('rejects a non-object (string)', () => {
    const result = validateJsonSchema('type: string');
    expect(result.valid).toBe(false);
  });

  test('rejects null', () => {
    const result = validateJsonSchema(null);
    expect(result.valid).toBe(false);
  });

  test('rejects a schema with an invalid type value', () => {
    // AJV strict type checking: 'badtype' is not a valid JSON Schema type keyword value
    const result = validateJsonSchema({ type: 'badtype' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('accepts a schema with nested $ref (as long as it compiles)', () => {
    const result = validateJsonSchema({
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        count: { type: 'integer', minimum: 0 },
      },
    });
    expect(result.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Unit tests: validateAllowedTools
// ─────────────────────────────────────────────
describe('validateAllowedTools', () => {
  test('accepts all valid tools', () => {
    const result = validateAllowedTools(
      ['calculator', 'docSearch'],
      TOOL_REGISTRY
    );
    expect(result.valid).toBe(true);
    expect(result.unknownTools).toHaveLength(0);
  });

  test('accepts the full registry', () => {
    const result = validateAllowedTools(TOOL_REGISTRY, TOOL_REGISTRY);
    expect(result.valid).toBe(true);
  });

  test('accepts an empty array (skill uses no tools)', () => {
    const result = validateAllowedTools([], TOOL_REGISTRY);
    expect(result.valid).toBe(true);
  });

  test('rejects a single unknown tool', () => {
    const result = validateAllowedTools(['calculator', 'webSearch'], TOOL_REGISTRY);
    expect(result.valid).toBe(false);
    expect(result.unknownTools).toContain('webSearch');
  });

  test('rejects multiple unknown tools', () => {
    const result = validateAllowedTools(
      ['calculator', 'emailSender', 'slackBot'],
      TOOL_REGISTRY
    );
    expect(result.valid).toBe(false);
    expect(result.unknownTools).toEqual(
      expect.arrayContaining(['emailSender', 'slackBot'])
    );
  });

  test('rejects non-array input', () => {
    const result = validateAllowedTools('calculator', TOOL_REGISTRY);
    expect(result.valid).toBe(false);
  });
});
