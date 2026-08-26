// __tests__/helpers.js
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const Usuario = require('../models/Usuario');

const PASSWORD_POR_DEFECTO = 'Secret123';

function uniqueEmail(prefix = 'test') {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now();
  return `${prefix}_${ts}_${rand}@mail.com`;
}

/**
 * Crea un usuario directamente contra el modelo, sin pasar por la API.
 *
 * Es deliberado: la API pública ya no permite auto-asignarse 'admin' ni
 * 'profesor' sin clave, así que los fixtures con privilegios se montan por
 * debajo. Si un test necesita comprobar qué puede pedir un cliente, debe usar
 * el endpoint de verdad, no este helper.
 */
async function crearUsuario({
  rol = 'estudiante',
  nombre = 'Test',
  correo = uniqueEmail(rol),
  password = PASSWORD_POR_DEFECTO,
} = {}) {
  const hash = await bcrypt.hash(password, 10);
  const usuario = await Usuario.create({ nombre, correo, contraseña: hash, rol });
  return { usuario, id: String(usuario._id), correo, password, rol };
}

/** Hace login y devuelve el token; falla ruidosamente si el login no va bien. */
async function login(correo, password = PASSWORD_POR_DEFECTO) {
  const res = await request(app).post('/api/auth/login').send({ correo, contraseña: password });

  if (res.status !== 200) {
    throw new Error(`No pudo loguear (${res.status}): ${JSON.stringify(res.body)}`);
  }

  const token = res.body.token || res.body.accessToken;
  if (!token) throw new Error('API no devolvió token en /api/auth/login');
  return token;
}

/** Crea un usuario con el rol pedido y devuelve su token ya listo. */
async function createUserAndLogin(rol = 'admin', opciones = {}) {
  const creado = await crearUsuario({ rol, ...opciones });
  const token = await login(creado.correo, creado.password);
  return { ...creado, token };
}

/** Atajo para los tests que solo necesitan un token de admin. */
async function adminToken() {
  const { token } = await createUserAndLogin('admin');
  return token;
}

module.exports = {
  createUserAndLogin,
  crearUsuario,
  login,
  adminToken,
  uniqueEmail,
  PASSWORD_POR_DEFECTO,
};
