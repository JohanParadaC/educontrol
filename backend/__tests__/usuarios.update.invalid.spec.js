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

describe('Usuarios update inválido', () => {
  it('PUT /api/usuarios/:id con body inválido → 400 (o 404 si valida existencia primero)', async () => {
    const token = await tokenAdmin();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .put(`/api/usuarios/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ correo: 'no-es-correo' }); // fuerza validación del controlador o express-validator
    expect([400, 404]).toContain(res.status);
  });
});