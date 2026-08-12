/**
 * Phase 1 Integration Tests — full API route testing
 *
 * Uses mongodb-memory-server so NO local MongoDB installation is needed.
 * Each test suite gets a fresh, isolated in-memory DB.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}, 180000); // 3 min timeout — mongodb-memory-server downloads its binary on first run

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  // Clean the DB between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ─────────────────────────────────────────────
// Helper: valid skill payload
// ─────────────────────────────────────────────
const validSkill = () => ({
  name: 'Test Skill',
  purpose: 'A test skill for integration testing',
  instructions: 'Do the thing carefully',
  inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
  allowedTools: ['calculator', 'docSearch'],
  approvalRequiredActions: [],
  maxSteps: 5,
});

// ─────────────────────────────────────────────
// POST /api/skills — Create skill
// ─────────────────────────────────────────────
describe('POST /api/skills', () => {
  test('creates a draft skill with valid payload', async () => {
    const res = await request(app).post('/api/skills').send(validSkill());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.version).toBe(1);
    expect(res.body.name).toBe('Test Skill');
  });

  test('rejects a skill with invalid inputSchema (bad type keyword)', async () => {
    const res = await request(app)
      .post('/api/skills')
      .send({ ...validSkill(), inputSchema: { type: 'badtype' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(
      res.body.details.some((d) => d.toLowerCase().includes('inputschema'))
    ).toBe(true);
  });

  test('rejects a skill with invalid outputSchema (array instead of object)', async () => {
    const res = await request(app)
      .post('/api/skills')
      .send({ ...validSkill(), outputSchema: [{ type: 'string' }] });
    expect(res.status).toBe(400);
  });

  test('rejects a skill with unknown tool in allowedTools', async () => {
    const res = await request(app)
      .post('/api/skills')
      .send({ ...validSkill(), allowedTools: ['calculator', 'webSearch'] });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('webSearch');
  });

  test('rejects a skill missing required fields', async () => {
    const res = await request(app)
      .post('/api/skills')
      .send({ name: 'Incomplete Skill' });
    expect(res.status).toBe(400);
  });

  test('always creates as draft regardless of what status is sent', async () => {
    const res = await request(app)
      .post('/api/skills')
      .send({ ...validSkill(), status: 'published' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft'); // server overrides to draft
  });
});

// ─────────────────────────────────────────────
// GET /api/skills — List skills
// ─────────────────────────────────────────────
describe('GET /api/skills', () => {
  test('returns empty array when no skills exist', async () => {
    const res = await request(app).get('/api/skills');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns all skills', async () => {
    await request(app).post('/api/skills').send(validSkill());
    await request(app).post('/api/skills').send({ ...validSkill(), name: 'Skill 2' });
    const res = await request(app).get('/api/skills');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test('filters by status=draft', async () => {
    const created = await request(app).post('/api/skills').send(validSkill());
    await request(app).post(`/api/skills/${created.body._id}/publish`);
    await request(app).post('/api/skills').send({ ...validSkill(), name: 'Another Draft' });

    const res = await request(app).get('/api/skills?status=draft');
    expect(res.status).toBe(200);
    expect(res.body.every((s) => s.status === 'draft')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GET /api/skills/:id — Get single skill
// ─────────────────────────────────────────────
describe('GET /api/skills/:id', () => {
  test('returns the skill by ID', async () => {
    const created = await request(app).post('/api/skills').send(validSkill());
    const res = await request(app).get(`/api/skills/${created.body._id}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(created.body._id);
  });

  test('returns 404 for nonexistent ID', async () => {
    const res = await request(app).get('/api/skills/64a1f5c3b1d4e2a3f6789012');
    expect(res.status).toBe(404);
  });

  test('returns 400 for malformed ID', async () => {
    const res = await request(app).get('/api/skills/not-an-id');
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// PUT /api/skills/:id — Edit draft skill
// THE KEY PHASE 1 BEHAVIOR: published skills CANNOT be edited
// ─────────────────────────────────────────────
describe('PUT /api/skills/:id', () => {
  test('can edit a draft skill', async () => {
    const created = await request(app).post('/api/skills').send(validSkill());
    const res = await request(app)
      .put(`/api/skills/${created.body._id}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  test('returns 409 when editing a published skill (blocked state transition)', async () => {
    const created = await request(app).post('/api/skills').send(validSkill());
    await request(app).post(`/api/skills/${created.body._id}/publish`);

    const res = await request(app)
      .put(`/api/skills/${created.body._id}`)
      .send({ name: 'Trying to edit published' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
  });

  test('PUT still validates JSON Schema on update', async () => {
    const created = await request(app).post('/api/skills').send(validSkill());
    const res = await request(app)
      .put(`/api/skills/${created.body._id}`)
      .send({ inputSchema: { type: 'notvalid' } });
    expect(res.status).toBe(400);
  });

  test('PUT still validates allowedTools on update', async () => {
    const created = await request(app).post('/api/skills').send(validSkill());
    const res = await request(app)
      .put(`/api/skills/${created.body._id}`)
      .send({ allowedTools: ['emailer'] });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /api/skills/:id/publish — Publish flow
// ─────────────────────────────────────────────
describe('POST /api/skills/:id/publish', () => {
  test('publishes a draft skill and sets status=published', async () => {
    const created = await request(app).post('/api/skills').send(validSkill());
    const res = await request(app).post(`/api/skills/${created.body._id}/publish`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
  });

  test('returns 409 when publishing an already-published skill', async () => {
    const created = await request(app).post('/api/skills').send(validSkill());
    await request(app).post(`/api/skills/${created.body._id}/publish`);

    const res = await request(app).post(`/api/skills/${created.body._id}/publish`);
    expect(res.status).toBe(409);
  });

  test('increments version when draft references a previousVersionId', async () => {
    // Create and publish v1
    const v1 = await request(app).post('/api/skills').send(validSkill());
    await request(app).post(`/api/skills/${v1.body._id}/publish`);

    // Create a v2 draft pointing at v1
    const v2Draft = await request(app)
      .post('/api/skills')
      .send({ ...validSkill(), name: 'v2 Draft', previousVersionId: v1.body._id });
    expect(v2Draft.status).toBe(201);

    // Publish v2 — version should increment to 2
    const v2Published = await request(app).post(`/api/skills/${v2Draft.body._id}/publish`);
    expect(v2Published.status).toBe(200);
    expect(v2Published.body.version).toBe(2);
    expect(v2Published.body.previousVersionId).toBe(v1.body._id);
  });
});
