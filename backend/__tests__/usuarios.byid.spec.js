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

describe('Usuarios byId', () => {
  it('GET /api/usuarios/:id con id inválido → 400', async () => {
    const token = await tokenAdmin();
    const res = await request(app)
      .get('/api/usuarios/xxx')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status); // la mayoría devuelve 400 por ObjectId inválido
  });

  it('GET /api/usuarios/:id válido pero inexistente → 404/400', async () => {
    const token = await tokenAdmin();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/usuarios/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect([404, 400]).toContain(res.status);
  });

  it('PUT /api/usuarios/:id inválido → 400/404', async () => {
    const token = await tokenAdmin();
    const res = await request(app)
      .put('/api/usuarios/xxx')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Nuevo' });
    expect([400, 404]).toContain(res.status);
  });
});