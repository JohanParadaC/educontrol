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

describe('Usuarios list & delete not found', () => {
  it('GET /api/usuarios responde 200 y array', async () => {
    const token = await tokenAdmin();
    const { status, body } = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${token}`);

    expect(status).toBe(200);
    expect(Array.isArray(body.usuarios ?? body)).toBe(true);
  });

  it('DELETE /api/usuarios/:id con id inexistente → 404/400', async () => {
    const token = await tokenAdmin();
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .delete(`/api/usuarios/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect([404, 400]).toContain(res.status);
  });
});