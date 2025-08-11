const request = require('supertest');
const app = require('../app');

async function loginEstudiante() {
  const correo = `estu_${Date.now()}@mail.com`;
  const pass = 'Estu123!';
  // Muchos setups permiten crear usuarios sin token:
  await request(app).post('/api/usuarios')
    .send({ nombre: 'Estu', correo, contraseña: pass, rol: 'estudiante' })
    .expect([200, 201]);

  const { body } = await request(app).post('/api/auth/login')
    .send({ correo, contraseña: pass, password: pass })
    .expect(200);

  return body.token;
}

describe('Inscripciones validaciones', () => {
  it('POST /api/inscripciones sin body esperado → 400', async () => {
    const token = await loginEstudiante();
    const res = await request(app)
      .post('/api/inscripciones')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([400, 422]).toContain(res.status);
  });

  it('POST /api/inscripciones con cursoId inválido → 400', async () => {
    const token = await loginEstudiante();
    const res = await request(app)
      .post('/api/inscripciones')
      .set('Authorization', `Bearer ${token}`)
      .send({ cursoId: 'xxx' });
    expect([400, 422]).toContain(res.status);
  });
});