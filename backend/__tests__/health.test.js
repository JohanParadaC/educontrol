// backend/__tests__/health.test.js
process.env.NODE_ENV = 'test'; // por si acaso
const request = require('supertest');
const app = require('../app');

describe('GET /api/health', () => {
  it('responde 200 y ok:true', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ ok: true }));
  });
});