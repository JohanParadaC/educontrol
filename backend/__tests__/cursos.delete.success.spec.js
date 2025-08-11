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

describe('Cursos delete (happy path)', () => {
  it('crea curso, lo elimina y luego GET by id devuelve 404/400', async () => {
    const adminToken = await tokenAdmin();

    // 1) Crear curso
    const nombre = `Curso ${Date.now()}`;
    const createRes = await request(app)
      .post('/api/cursos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre, descripcion: 'desc' })
      .expect([200, 201]);

    // 2) Obtener id (del create o de la lista)
    let cursoId = createRes.body?.curso?._id || createRes.body?._id || createRes.body?.id;
    if (!cursoId) {
      const listRes = await request(app)
        .get('/api/cursos')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const arr = listRes.body.cursos ?? listRes.body ?? [];
      const found = Array.isArray(arr) ? arr.find(c => c.nombre === nombre) : null;
      cursoId = found?._id || found?.id;
    }

    // 3) DELETE success
    await request(app)
      .delete(`/api/cursos/${cursoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect([200, 204]);

    // 4) GET by id luego → 404/400
    await request(app)
      .get(`/api/cursos/${cursoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect([404, 400]);
  });
});