// __tests__/seguridad.usuarios.update.spec.js
// ---------------------------------------------------------------------------
// PUT /api/usuarios/:id comprobaba la propiedad SOLO dentro del bloque que
// cambiaba 'rol'. Nombre, correo y contraseña se aplicaban a cualquier id, así
// que un estudiante autenticado podía cambiarle la contraseña al admin.
//
// El segundo bloque cubre el ascenso a profesor: el frontend pedía una clave en
// un diálogo y la enviaba como `profesorClave`, pero el backend no la leía.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Usuario = require('../models/Usuario');
const { createUserAndLogin, crearUsuario, login } = require('./helpers');

const CLAVE_PROFESOR = process.env.PROFESOR_CLAVE;

const put = (id, token, body) =>
  request(app).put(`/api/usuarios/${id}`).set('Authorization', `Bearer ${token}`).send(body);

describe('PUT /api/usuarios/:id — propiedad', () => {
  it('sin token → 401', async () => {
    const otro = await crearUsuario({ rol: 'admin' });

    const res = await request(app).put(`/api/usuarios/${otro.id}`).send({ nombre: 'Hackeado' });

    expect(res.status).toBe(401);
  });

  it('un estudiante no puede cambiar el nombre de otro usuario → 403', async () => {
    const atacante = await createUserAndLogin('estudiante');
    const victima = await crearUsuario({ rol: 'admin', nombre: 'Admin' });

    const res = await put(victima.id, atacante.token, { nombre: 'Hackeado' });

    expect(res.status).toBe(403);
    expect((await Usuario.findById(victima.id)).nombre).toBe('Admin');
  });

  it('un estudiante no puede cambiar el correo de otro usuario → 403', async () => {
    const atacante = await createUserAndLogin('estudiante');
    const victima = await crearUsuario({ rol: 'admin' });

    const res = await put(victima.id, atacante.token, { correo: 'atacante@mail.com' });

    expect(res.status).toBe(403);
    expect((await Usuario.findById(victima.id)).correo).toBe(victima.correo);
  });

  it('un estudiante no puede cambiar la contraseña del admin → 403 y la vieja sigue sirviendo', async () => {
    const atacante = await createUserAndLogin('estudiante');
    const victima = await crearUsuario({ rol: 'admin', password: 'AdminSeguro1' });

    const res = await put(victima.id, atacante.token, { contraseña: 'AhoraEsMia1' });

    expect(res.status).toBe(403);

    // La contraseña del atacante no funciona...
    const intento = await request(app)
      .post('/api/auth/login')
      .send({ correo: victima.correo, contraseña: 'AhoraEsMia1' });
    expect(intento.status).toBe(401);

    // ...y el admin conserva la suya.
    await expect(login(victima.correo, 'AdminSeguro1')).resolves.toEqual(expect.any(String));
  });

  it('un usuario sí puede editarse a sí mismo → 200', async () => {
    const yo = await createUserAndLogin('estudiante');

    const res = await put(yo.id, yo.token, { nombre: 'Mi nuevo nombre' });

    expect(res.status).toBe(200);
    expect(res.body.usuario.nombre).toBe('Mi nuevo nombre');
  });

  it('un admin puede editar a cualquiera → 200', async () => {
    const admin = await createUserAndLogin('admin');
    const otro = await crearUsuario({ rol: 'estudiante' });

    const res = await put(otro.id, admin.token, { nombre: 'Renombrado por admin' });

    expect(res.status).toBe(200);
    expect(res.body.usuario.nombre).toBe('Renombrado por admin');
  });
});

describe('PUT /api/usuarios/:id — cambio de rol', () => {
  it('un estudiante no se asciende a profesor sin la clave → 403', async () => {
    const yo = await createUserAndLogin('estudiante');

    const res = await put(yo.id, yo.token, { rol: 'profesor' });

    expect(res.status).toBe(403);
    expect((await Usuario.findById(yo.id)).rol).toBe('estudiante');
  });

  it('un estudiante no se asciende con una clave incorrecta → 403', async () => {
    const yo = await createUserAndLogin('estudiante');

    const res = await put(yo.id, yo.token, { rol: 'profesor', profesorClave: 'no-es-esta' });

    expect(res.status).toBe(403);
    expect((await Usuario.findById(yo.id)).rol).toBe('estudiante');
  });

  it('un estudiante sí se asciende con la clave correcta → 200', async () => {
    const yo = await createUserAndLogin('estudiante');

    const res = await put(yo.id, yo.token, { rol: 'profesor', profesorClave: CLAVE_PROFESOR });

    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('profesor');
  });

  it('nadie se convierte en admin por esta vía → 400', async () => {
    const yo = await createUserAndLogin('estudiante');

    const res = await put(yo.id, yo.token, { rol: 'admin' });

    expect(res.status).toBe(400);
    expect((await Usuario.findById(yo.id)).rol).toBe('estudiante');
  });

  it('un admin puede asignar el rol profesor sin clave', async () => {
    const admin = await createUserAndLogin('admin');
    const otro = await crearUsuario({ rol: 'estudiante' });

    const res = await put(otro.id, admin.token, { rol: 'profesor' });

    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('profesor');
  });

  it('el rol degradado se aplica de inmediato aunque el token diga otra cosa', async () => {
    // roleCheck lee el rol del documento, no el claim del JWT: un admin
    // degradado pierde el acceso sin esperar a que caduque su token.
    const admin = await createUserAndLogin('admin');
    const otroAdmin = await createUserAndLogin('admin');

    await put(admin.id, otroAdmin.token, { rol: 'estudiante' }).expect(200);

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(403);
  });
});
