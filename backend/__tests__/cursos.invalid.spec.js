const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

async function tokenAdmin() {
  await request(app).post('/api/admin/seed-admin')
    .send({ correo: 'admin@educontrol.com', password: 'admin123', nombre: 'Admin' })
    .expect([200, 201]);

  const { body } = await request(app).post('/api/auth/login')
    .send({ correo: 'admin@educontrol.com', contraseña: 'admin123', password: 'admin123' })
    .expect(200);

  return body.token;
}

describe('Cursos (payload inválido)', () => {
  it('POST /api/cursos sin campos requeridos → 400', async () => {
    const adminToken = await tokenAdmin();
    const res = await request(app)
      .post('/api/cursos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toBeTruthy();
  });

  it('PUT /api/cursos/:id con body inválido → 400 (o 404 si valida existencia primero)', async () => {
    const adminToken = await tokenAdmin();
    const someId = new mongoose.Types.ObjectId().toString(); // válido pero inexistente
    const res = await request(app)
      .put(`/api/cursos/${someId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: '' }); // fuerza validación
    expect([400, 404]).toContain(res.status);
  });
});