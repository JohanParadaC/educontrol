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

describe('Usuarios CRUD (happy path)', () => {
  it('crea, lee, actualiza y elimina un usuario', async () => {
    const adminToken = await tokenAdmin();

    // 1) Crear usuario
    const correo = `user_${Date.now()}@mail.com`;
    await request(app)
      .post('/api/usuarios')
      .send({ nombre: 'Pepe', correo, contraseña: 'User123!', rol: 'estudiante' })
      .expect([200, 201]);

    // 2) Listar y obtener _id por correo (por si el create no devuelve el id)
    const listRes = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const arr = listRes.body.usuarios ?? listRes.body ?? [];
    const creado = Array.isArray(arr) ? arr.find(u => u.correo === correo) : null;
    expect(creado).toBeTruthy();
    const id = creado?._id || creado?.id;

    // 3) GET by id (success)
    const getRes = await request(app)
      .get(`/api/usuarios/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(getRes.body).toBeTruthy();

    // 4) UPDATE (success)
    const putRes = await request(app)
      .put(`/api/usuarios/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Pepe Actualizado' })
      .expect([200, 204]);
    // si devuelve 200, usualmente regresa el usuario:
    if (putRes.status === 200) {
      const u = putRes.body.usuario || putRes.body.user || putRes.body;
      if (u && u.nombre) expect(u.nombre).toBe('Pepe Actualizado');
    }

    // 5) DELETE (success)
    await request(app)
      .delete(`/api/usuarios/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect([200, 204]);

    // 6) GET by id otra vez → 404/400
    await request(app)
      .get(`/api/usuarios/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect([404, 400]);
  });
});