// __tests__/usuarios.duplicate.spec.js
const request = require('supertest');
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

describe('Usuarios duplicado', () => {
  it('retorna 400/409 si el correo ya existe', async () => {
    const token = await tokenAdmin();
    const correo = `dup_${Date.now()}@edu.com`;

    // primero OK
    await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Uno', correo, contraseña: 'secret', rol: 'estudiante' })
      .expect([200, 201]);

    // duplicado
    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Dos', correo, contraseña: 'secret', rol: 'estudiante' });

    expect([400, 409]).toContain(res.status);
  });
});