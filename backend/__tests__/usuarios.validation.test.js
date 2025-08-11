// __tests__/usuarios.validation.test.js
const request = require('supertest');
const app = require('../app');

async function tokenAdmin() {
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

describe('Usuarios validations', () => {
  it('POST /api/usuarios -> 400 si faltan campos', async () => {
    const token = await tokenAdmin();

    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: '', correo: 'mal', rol: 'estudiante' });

    expect(res.status).toBe(400);
  });

  it('POST /api/usuarios -> 201/200 crea usuario válido', async () => {
    const token = await tokenAdmin();

    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Nuevo',
        correo: `nuevo_${Date.now()}@edu.com`,
        contraseña: 'secret',
        rol: 'estudiante',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('usuario');
  });
});