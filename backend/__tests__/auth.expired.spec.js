// __tests__/auth.expired.spec.js
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

describe('Auth middleware (token expirado)', () => {
  it('responde 401 con token expirado', async () => {
    const token = jwt.sign(
      { uid: 'fake-user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: -60 } // ya expirado
    );

    const res = await request(app)
      .get('/api/cursos') // usa una ruta protegida real
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});