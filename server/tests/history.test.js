const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Skill = require('../src/models/Skill');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Skill.deleteMany({});
});

describe('Phase 4: History and Versioning APIs', () => {
  it('should traverse the previousVersionId chain and return versions oldest to newest', async () => {
    // Create V1
    const v1Res = await request(app)
      .post('/api/skills')
      .send({
        name: 'History Test Skill',
        purpose: 'V1',
        instructions: 'Test v1',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        allowedTools: []
      });
    const v1Id = v1Res.body._id;
    await request(app).post(`/api/skills/${v1Id}/publish`);

    // Create V2
    const v2Res = await request(app).post('/api/skills').send({
      name: 'History Test Skill',
      purpose: 'V2',
      instructions: 'Test v1',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      allowedTools: [],
      previousVersionId: v1Id
    });
    const v2Id = v2Res.body._id;
    await request(app).post(`/api/skills/${v2Id}/publish`);

    // Create V3
    const v3Res = await request(app).post('/api/skills').send({
      name: 'History Test Skill',
      purpose: 'V3',
      instructions: 'Test v1',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      allowedTools: [],
      previousVersionId: v2Id
    });
    const v3Id = v3Res.body._id;
    await request(app).post(`/api/skills/${v3Id}/publish`);

    // Fetch versions from V3
    const versionsRes = await request(app).get(`/api/skills/${v3Id}/versions`);
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.body.length).toBe(3);
    
    // Should be oldest to newest
    expect(versionsRes.body[0].purpose).toBe('V1');
    expect(versionsRes.body[1].purpose).toBe('V2');
    expect(versionsRes.body[2].purpose).toBe('V3');
  });

  it('should compare two versions and return the diff', async () => {
    const v1Res = await request(app)
      .post('/api/skills')
      .send({
        name: 'Diff Skill',
        purpose: 'V1 Purpose',
        instructions: 'V1 Instructions',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        allowedTools: ['calculator']
      });
    const v1Id = v1Res.body._id;
    await request(app).post(`/api/skills/${v1Id}/publish`);

    const v2Res = await request(app).post('/api/skills').send({ 
      name: 'Diff Skill',
      purpose: 'V1 Purpose',
      instructions: 'V2 Instructions',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      allowedTools: ['calculator', 'docSearch'],
      previousVersionId: v1Id
    });
    const v2Id = v2Res.body._id;

    const diffRes = await request(app).get(`/api/skills/versions/compare?from=${v1Id}&to=${v2Id}`);
    expect(diffRes.status).toBe(200);

    const { diff } = diffRes.body;
    expect(diff).toHaveProperty('instructions');
    expect(diff.instructions.old).toBe('V1 Instructions');
    expect(diff.instructions.new).toBe('V2 Instructions');

    expect(diff).toHaveProperty('allowedTools');
    expect(diff.allowedTools.old).toEqual(['calculator']);
    expect(diff.allowedTools.new).toEqual(['calculator', 'docSearch']);

    // Purpose didn't change
    expect(diff).not.toHaveProperty('purpose');
  });
});
