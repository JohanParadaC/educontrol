// __tests__/errorHandler.test.js
const request = require('supertest');
const app = require('../app');

describe('Error handler', () => {
  it('devuelve 500 y ok:false en /api/admin/boom (solo test)', async () => {
    const res = await request(app).get('/api/admin/boom');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('ok', false);
    // El mensaje en tu handler suele ser "Hable con el administrador"
    // si quieres verificar shape:
    // expect(res.body).toHaveProperty('msg');
  });
});