// __tests__/cursos.spec.js
const request = require('supertest');
const app = require('../app');

async function seedAdminYToken() {
  await request(app)
    .post('/api/admin/seed-admin')
    .send({ correo: 'admin@educontrol.com', password: 'admin123', nombre: 'Admin' })
    .expect([200, 201]);

  const { body } = await request(app)
    .post('/api/auth/login')
    .send({ correo: 'admin@educontrol.com', contraseña: 'admin123', password: 'admin123' })
    .expect(200);

  return body.token;
}

describe('Cursos', () => {
  it('GET /api/cursos lista (requiere token)', async () => {
    const token = await seedAdminYToken();

    const { status, body } = await request(app)
      .get('/api/cursos')
      .set('Authorization', `Bearer ${token}`);

    expect(status).toBe(200);
    expect(Array.isArray(body.cursos ?? body)).toBe(true);
  });

  it('GET /api/cursos/:id -> 400 con id inválido (con token)', async () => {
    const token = await seedAdminYToken();

    await request(app)
      .get('/api/cursos/xxx')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('POST /api/cursos crea curso (201/200) [admin]', async () => {
    const token = await seedAdminYToken();

    const res = await request(app)
      .post('/api/cursos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Angular Básico', descripcion: 'Intro' });

    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('curso');
  });

  it('PUT /api/cursos/:id -> 404/400 si no existe [admin]', async () => {
    const token = await seedAdminYToken();
    const fakeId = '66a7c1b2a1a1a1a1a1a1a1a1'; // ObjectId-like

    const res = await request(app)
      .put(`/api/cursos/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Nuevo nombre' });

    expect([404, 400]).toContain(res.status);
  });
});