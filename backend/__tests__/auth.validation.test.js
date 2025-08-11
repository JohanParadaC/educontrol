// __tests__/auth.validation.test.js
const request = require('supertest');
const app = require('../app');

describe('Auth validations', () => {
  it('POST /api/auth/login -> 400 si faltan campos', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login -> 400/401 credenciales inválidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'no-existe@mail.com', contraseña: 'x', password: 'x' });
    expect([400, 401]).toContain(res.status);
  });

  it('POST /api/auth/login -> 200 con credenciales correctas', async () => {
    // Seed admin para ESTE test (porque afterEach limpia la DB)
    await request(app)
      .post('/api/admin/seed-admin')
      .send({ correo: 'admin@educontrol.com', password: 'admin123', nombre: 'Admin' })
      .expect([200, 201]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'admin@educontrol.com', contraseña: 'admin123', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('usuario');
  });
});