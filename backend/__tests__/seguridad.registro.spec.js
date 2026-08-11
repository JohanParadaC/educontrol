// __tests__/seguridad.registro.spec.js
// ---------------------------------------------------------------------------
// El registro es anónimo, así que el rol que llega en el body es un deseo del
// cliente, no un dato de confianza. Antes el validador aceptaba
// isIn(['estudiante','profesor','admin']) y cualquiera se registraba como
// administrador.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Usuario = require('../models/Usuario');
const { uniqueEmail } = require('./helpers');

const CLAVE_PROFESOR = process.env.PROFESOR_CLAVE;

const registrar = (body) => request(app).post('/api/usuarios').send(body);

const base = () => ({
  nombre: 'Nuevo',
  correo: uniqueEmail('registro'),
  'contraseña': 'Secret123'
});

describe('POST /api/usuarios (registro público)', () => {
  it('rol "admin" → 400 y no se crea nada', async () => {
    const res = await registrar({ ...base(), rol: 'admin' });

    expect(res.status).toBe(400);
    expect(await Usuario.countDocuments()).toBe(0);
  });

  it('rol "profesor" sin clave → 403', async () => {
    const res = await registrar({ ...base(), rol: 'profesor' });

    expect(res.status).toBe(403);
    expect(await Usuario.countDocuments()).toBe(0);
  });

  it('rol "profesor" con clave incorrecta → 403', async () => {
    const res = await registrar({ ...base(), rol: 'profesor', profesorClave: 'no-es-esta' });

    expect(res.status).toBe(403);
    expect(await Usuario.countDocuments()).toBe(0);
  });

  it('rol "profesor" con la clave correcta → 201', async () => {
    const datos = base();

    const res = await registrar({ ...datos, rol: 'profesor', profesorClave: CLAVE_PROFESOR });

    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe('profesor');
  });

  it('rol "estudiante" → 201', async () => {
    const res = await registrar({ ...base(), rol: 'estudiante' });

    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe('estudiante');
  });

  it('sin rol → 201 como estudiante', async () => {
    const res = await registrar(base());

    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe('estudiante');
  });

  it('nunca devuelve la contraseña', async () => {
    const res = await registrar(base());

    expect(res.body.usuario).not.toHaveProperty('contraseña');
  });
});
