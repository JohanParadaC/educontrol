const request = require('supertest');
const app = require('../app');

describe('App 404', () => {
  it('devuelve 404 y shape esperado para rutas inexistentes', async () => {
    const { status, body } = await request(app).get('/api/no-existe-xyz');
    expect(status).toBe(404);
    expect(body).toEqual(expect.objectContaining({ ok: false }));
  });
});