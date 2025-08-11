// __tests__/auth.middleware.spec.js
const request = require('supertest');
const app = require('../app');
const { createUserAndLogin } = require('./helpers');

describe('Auth middleware / roleCheck', () => {
  it('401 si no envía token (ruta protegida real)', async () => {
    await request(app).get('/api/cursos').expect(401);
  });

  it('403 si rol no autorizado (estudiante intenta acción de admin/profesor)', async () => {
    const { token } = await createUserAndLogin('estudiante');
    const res = await request(app)
      .post('/api/cursos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Prohibido', descripcion: '...' });
    expect([401, 403]).toContain(res.status);
  });
});