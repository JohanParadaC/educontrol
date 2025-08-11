// __tests__/helpers.js
const request = require('supertest');
const app = require('../app');

function uniqueEmail(prefix = 'test') {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now();
  return `${prefix}_${ts}_${rand}@mail.com`;
}

async function createUserAndLogin(rol = 'admin') {
  const correo = uniqueEmail('user');
  const pass = 'Secret123';

  // 1) crear usuario
  const createRes = await request(app).post('/api/usuarios').send({
    nombre: 'Test',
    correo,
    rol,
    // tu API valida este campo
    'contraseña': pass,
    // por compatibilidad si tu modelo lo admite
    password: pass,
  });

  if (![200, 201].includes(createRes.status)) {
    console.error('❌ Falla creando usuario', { status: createRes.status, body: createRes.body });
    throw new Error(`No pudo crear usuario: ${createRes.status}`);
  }

  // 2) login
  const loginRes = await request(app).post('/api/auth/login').send({
    correo,
    'contraseña': pass,
    password: pass,
  });

  if (loginRes.status !== 200) {
    console.error('❌ Falla login', { status: loginRes.status, body: loginRes.body });
    throw new Error(`No pudo loguear: ${loginRes.status}`);
  }

  const token = loginRes.body.token || loginRes.body.accessToken;
  if (!token) throw new Error('API no devolvió token en /api/auth/login');

  return { token, correo };
}

module.exports = { createUserAndLogin, uniqueEmail };