// __tests__/paginacion.spec.js
// ---------------------------------------------------------------------------
// Los listados devolvían la colección entera en cada petición.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Usuario = require('../models/Usuario');
const Curso = require('../models/Curso');
const { createUserAndLogin, crearUsuario } = require('./helpers');
const { LIMITE_MAXIMO } = require('../utils/paginacion');

/** Crea n usuarios extra sin pasar por la API (más rápido y no valida roles). */
async function sembrarUsuarios(n) {
  const docs = Array.from({ length: n }, (_, i) => ({
    nombre: `Usuario ${String(i).padStart(3, '0')}`,
    correo: `bulk_${i}_${Date.now()}@mail.com`,
    contraseña: 'x'.repeat(60),
    rol: 'estudiante',
  }));
  await Usuario.insertMany(docs);
}

describe('GET /api/usuarios — paginación', () => {
  it('devuelve metadatos junto a la lista', async () => {
    const { token } = await createUserAndLogin('admin');

    const { body } = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.usuarios)).toBe(true);
    expect(body).toMatchObject({
      ok: true,
      total: expect.any(Number),
      pagina: 1,
      limite: expect.any(Number),
      paginas: expect.any(Number),
    });
  });

  it('respeta ?limit y ?page sin solaparse entre páginas', async () => {
    const { token } = await createUserAndLogin('admin');
    await sembrarUsuarios(9); // 9 + el admin = 10

    const cabecera = { Authorization: `Bearer ${token}` };

    const p1 = await request(app).get('/api/usuarios?page=1&limit=4').set(cabecera).expect(200);
    const p2 = await request(app).get('/api/usuarios?page=2&limit=4').set(cabecera).expect(200);
    const p3 = await request(app).get('/api/usuarios?page=3&limit=4').set(cabecera).expect(200);

    expect(p1.body.usuarios).toHaveLength(4);
    expect(p2.body.usuarios).toHaveLength(4);
    expect(p3.body.usuarios).toHaveLength(2);

    expect(p1.body.total).toBe(10);
    expect(p1.body.paginas).toBe(3);

    // Ningún usuario aparece en dos páginas distintas
    const ids = [...p1.body.usuarios, ...p2.body.usuarios, ...p3.body.usuarios].map(
      u => u.id ?? u._id
    );
    expect(new Set(ids).size).toBe(10);
  });

  it('un limit desmedido se recorta al máximo permitido', async () => {
    const { token } = await createUserAndLogin('admin');

    const { body } = await request(app)
      .get('/api/usuarios?limit=999999')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Sin este tope, el cliente podría reintroducir el problema desde fuera.
    expect(body.limite).toBe(LIMITE_MAXIMO);
  });

  it('valores basura en page/limit caen a los valores por defecto', async () => {
    const { token } = await createUserAndLogin('admin');

    const { body } = await request(app)
      .get('/api/usuarios?page=-3&limit=abc')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.pagina).toBe(1);
    expect(body.limite).toBeGreaterThan(0);
  });

  it('una página más allá del final devuelve lista vacía, no error', async () => {
    const { token } = await createUserAndLogin('admin');

    const { body } = await request(app)
      .get('/api/usuarios?page=99&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.usuarios).toHaveLength(0);
    expect(body.total).toBeGreaterThan(0);
  });

  it('nunca expone la contraseña, tampoco paginando', async () => {
    const { token } = await createUserAndLogin('admin');
    await sembrarUsuarios(3);

    const { body } = await request(app)
      .get('/api/usuarios?limit=100')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    body.usuarios.forEach(u => expect(u).not.toHaveProperty('contraseña'));
  });
});

describe('GET /api/cursos — paginación', () => {
  it('respeta ?limit y devuelve el total real', async () => {
    const { token } = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });

    await Curso.insertMany(
      Array.from({ length: 5 }, (_, i) => ({
        nombre: `Curso ${i}`,
        descripcion: 'demo',
        profesor: profesor.id,
      }))
    );

    const { body } = await request(app)
      .get('/api/cursos?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.cursos).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.paginas).toBe(3);
  });
});
