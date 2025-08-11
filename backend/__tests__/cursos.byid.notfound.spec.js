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

describe('Cursos GET by id not found', () => {
  it('retorna 404 (o 400 según tu lógica) con ObjectId válido inexistente', async () => {
    const token = await tokenAdmin();
    const idValido = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .get(`/api/cursos/${idValido}`)
      .set('Authorization', `Bearer ${token}`);

    expect([404, 400]).toContain(res.status); // acepta ambas según tu controller
  });
});