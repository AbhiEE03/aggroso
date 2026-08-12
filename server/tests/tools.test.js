/**
 * Phase 2 Tests — Tools, permission layer, and test-run endpoint
 *
 * Section A: Pure unit tests (no DB) — tool functions and permission checks
 * Section B: Integration tests using mongodb-memory-server — /test endpoint
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');

const calculator = require('../src/tools/calculator');
const { docSearch } = require('../src/tools/docSearch');
const { recordLookup } = require('../src/tools/recordLookup');
const { assertToolAllowed } = require('../src/utils/permissionCheck');
const { UnauthorizedToolError, ApprovalRequiredError } = require('../src/errors/toolErrors');

// ─────────────────────────────────────────────
// A1: calculator tool (no DB, no permissions)
// ─────────────────────────────────────────────
describe('calculator tool', () => {
  test('evaluates a simple addition', () => {
    const { output, error } = calculator({ expression: '2 + 3' });
    expect(error).toBeNull();
    expect(output.result).toBe(5);
  });

  test('evaluates a compound expression', () => {
    const { output, error } = calculator({ expression: '(10 + 5) * 2 / 3' });
    expect(error).toBeNull();
    expect(output.result).toBeCloseTo(10);
  });

  test('rejects non-arithmetic string (SQL injection attempt)', () => {
    const { output, error } = calculator({ expression: 'DROP TABLE users' });
    expect(output).toBeNull();
    expect(error).toBeTruthy();
  });

  test('rejects empty expression', () => {
    const { output, error } = calculator({ expression: '' });
    expect(output).toBeNull();
    expect(error).toBeTruthy();
  });

  test('rejects non-numeric result (boolean comparison)', () => {
    // math.evaluate('1 == 1') returns a boolean — not a number
    const { output, error } = calculator({ expression: '1 == 1' });
    // Either the expression is blocked by regex or returns a non-numeric result
    if (output !== null) {
      // If it somehow ran, result should not be a string
      expect(typeof output.result).toBe('number');
    } else {
      expect(error).toBeTruthy();
    }
  });

  test('handles missing expression field gracefully', () => {
    const { output, error } = calculator({});
    expect(output).toBeNull();
    expect(error).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// A2: docSearch tool
// ─────────────────────────────────────────────
describe('docSearch tool', () => {
  test('returns results for a matching query', () => {
    const { output, error } = docSearch({ query: 'password reset' });
    expect(error).toBeNull();
    expect(output.results.length).toBeGreaterThan(0);
    expect(output.results[0].title.toLowerCase()).toContain('password');
  });

  test('returns empty results for a query with no matches', () => {
    const { output, error } = docSearch({ query: 'zzznomatchxxx' });
    expect(error).toBeNull();
    expect(output.totalFound).toBe(0);
  });

  test('respects the limit parameter', () => {
    const { output } = docSearch({ query: 'api', limit: 2 });
    expect(output.results.length).toBeLessThanOrEqual(2);
  });

  test('rejects an empty query', () => {
    const { output, error } = docSearch({ query: '' });
    expect(output).toBeNull();
    expect(error).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// A3: recordLookup tool
// ─────────────────────────────────────────────
describe('recordLookup tool', () => {
  test('looks up a record by exact ID', () => {
    const { output, error } = recordLookup({ id: 'cust-001' });
    expect(error).toBeNull();
    expect(output.records.length).toBe(1);
    expect(output.records[0].name).toBe('Alice Johnson');
  });

  test('filters records by type', () => {
    const { output } = recordLookup({ type: 'task' });
    expect(output.records.every((r) => r.type === 'task')).toBe(true);
  });

  test('filters by field+value', () => {
    const { output } = recordLookup({ field: 'status', value: 'pending' });
    expect(output.records.every((r) => r.status === 'pending')).toBe(true);
  });

  test('returns empty for no matching records', () => {
    const { output } = recordLookup({ id: 'nonexistent-999' });
    expect(output.totalFound).toBe(0);
  });

  test('rejects input with no usable filter', () => {
    const { output, error } = recordLookup({});
    expect(output).toBeNull();
    expect(error).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// A4: assertToolAllowed — permission enforcement
// ─────────────────────────────────────────────
describe('assertToolAllowed (permission check)', () => {
  const makeSkill = (allowedTools, approvalRequiredActions = []) => ({
    name: 'TestSkill',
    allowedTools,
    approvalRequiredActions,
  });

  test('allows a permitted read-only tool', () => {
    expect(() =>
      assertToolAllowed(makeSkill(['calculator', 'docSearch']), 'calculator')
    ).not.toThrow();
  });

  test('throws UnauthorizedToolError for a tool NOT in allowedTools', () => {
    expect(() =>
      assertToolAllowed(makeSkill(['calculator']), 'docSearch')
    ).toThrow(UnauthorizedToolError);
  });

  test('throws UnauthorizedToolError for a completely unknown tool', () => {
    expect(() =>
      assertToolAllowed(makeSkill(['calculator']), 'emailSender')
    ).toThrow(UnauthorizedToolError);
  });

  test('throws ApprovalRequiredError for write tool without approval', () => {
    const skill = makeSkill(['calculator', 'taskCreator'], ['taskCreator']);
    expect(() =>
      assertToolAllowed(skill, 'taskCreator', false)
    ).toThrow(ApprovalRequiredError);
  });

  test('allows write tool when isApproved=true', () => {
    const skill = makeSkill(['calculator', 'taskCreator'], ['taskCreator']);
    expect(() =>
      assertToolAllowed(skill, 'taskCreator', true)
    ).not.toThrow();
  });

  test('allows calculator even if taskCreator needs approval', () => {
    const skill = makeSkill(['calculator', 'taskCreator'], ['taskCreator']);
    expect(() =>
      assertToolAllowed(skill, 'calculator', false)
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────
// B: Integration tests — POST /api/skills/:id/test
// ─────────────────────────────────────────────
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 180000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

const validSkill = (overrides = {}) => ({
  name: 'Search Skill',
  purpose: 'Search documents and records',
  instructions: 'Search the documents and records for relevant information',
  inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
  allowedTools: ['docSearch', 'recordLookup'],
  approvalRequiredActions: [],
  maxSteps: 5,
  ...overrides,
});

describe('POST /api/skills/:id/test', () => {
  test('runs allowed read-only tools and returns trace', async () => {
    const created = await request(app).post('/api/skills').send(validSkill());
    expect(created.status).toBe(201);

    const res = await request(app)
      .post(`/api/skills/${created.body._id}/test`)
      .send({ sampleInput: { query: 'password reset' } });

    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.toolSelectionMethod).toBe('keyword_placeholder_phase2');
  });

  test('returns approval_required for taskCreator in allowedTools during test run', async () => {
    const skill = await request(app).post('/api/skills').send(
      validSkill({
        allowedTools: ['taskCreator'],
        approvalRequiredActions: ['taskCreator'],
        instructions: 'Create a task for the customer',
      })
    );

    const res = await request(app)
      .post(`/api/skills/${skill.body._id}/test`)
      .send({ sampleInput: { query: 'create task' } });

    expect(res.status).toBe(200);
    const taskCreatorResult = res.body.results.find((r) => r.tool === 'taskCreator');
    expect(taskCreatorResult).toBeDefined();
    expect(taskCreatorResult.status).toBe('approval_required');
  });

  test('rejects sampleInput that does not match inputSchema', async () => {
    const skill = await request(app).post('/api/skills').send(validSkill());

    const res = await request(app)
      .post(`/api/skills/${skill.body._id}/test`)
      .send({ sampleInput: { wrongField: 123 } }); // missing required 'query'

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  test('returns 400 when sampleInput is missing from body', async () => {
    const skill = await request(app).post('/api/skills').send(validSkill());
    const res = await request(app)
      .post(`/api/skills/${skill.body._id}/test`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('returns 404 for nonexistent skill', async () => {
    const res = await request(app)
      .post('/api/skills/64a1f5c3b1d4e2a3f6789012/test')
      .send({ sampleInput: { query: 'test' } });
    expect(res.status).toBe(404);
  });
});
