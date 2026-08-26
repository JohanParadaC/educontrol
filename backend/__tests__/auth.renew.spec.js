// __tests__/auth.renew.spec.js
// ---------------------------------------------------------------------------
// GET /api/auth/renew no lo probaba nadie, y es el endpoint del que depende que
// una sesión abierta siga siéndolo: el frontend lo llama en cada arranque.
// ---------------------------------------------------------------------------
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Usuario = require('../models/Usuario');
const { createUserAndLogin } = require('./helpers');

const renovar = token =>
  request(app).get('/api/auth/renew').set('Authorization', `Bearer ${token}`);

describe('GET /api/auth/renew', () => {
  it('sin token → 401', async () => {
    expect((await request(app).get('/api/auth/renew')).status).toBe(401);
  });

  it('con un token inventado → 401', async () => {
    expect((await renovar('esto.no.es.un.jwt')).status).toBe(401);
  });

  it('devuelve un token nuevo y los datos del usuario', async () => {
    const { token, correo } = await createUserAndLogin('estudiante');

    const { body } = await renovar(token).expect(200);

    expect(body.ok).toBe(true);
    expect(body.token).toEqual(expect.any(String));
    expect(body.usuario.correo).toBe(correo);
    expect(body.usuario).not.toHaveProperty('contraseña');
  });

  it('el token renovado sirve para autenticarse', async () => {
    const { token } = await createUserAndLogin('admin');

    const { body } = await renovar(token).expect(200);

    // El token nuevo tiene que valer para seguir trabajando.
    await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${body.token}`)
      .expect(200);
  });

  it('refleja el rol actual, no el que llevaba el token', async () => {
    // Un usuario degradado no puede seguir renovando credenciales de admin.
    const usuario = await createUserAndLogin('admin');
    await Usuario.findByIdAndUpdate(usuario.id, { rol: 'estudiante' });

    const { body } = await renovar(usuario.token).expect(200);

    expect(body.usuario.rol).toBe('estudiante');
  });

  it('si la cuenta ya no existe → 401', async () => {
    const { token, id } = await createUserAndLogin('estudiante');
    await Usuario.findByIdAndDelete(id);

    // validateJWT carga el usuario de la base: si no está, el token no vale.
    expect((await renovar(token)).status).toBe(401);
  });

  it('un token caducado → 401', async () => {
    const { id } = await createUserAndLogin('estudiante');
    const caducado = jwt.sign({ uid: id, rol: 'estudiante' }, process.env.JWT_SECRET, {
      expiresIn: '-1s',
    });

    expect((await renovar(caducado)).status).toBe(401);
  });

  it('un token firmado con otro secreto → 401', async () => {
    const { id } = await createUserAndLogin('estudiante');
    const ajeno = jwt.sign({ uid: id, rol: 'admin' }, 'otro-secreto-distinto', { expiresIn: '1h' });

    expect((await renovar(ajeno)).status).toBe(401);
  });
});
