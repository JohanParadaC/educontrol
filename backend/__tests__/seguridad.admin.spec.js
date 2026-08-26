// __tests__/seguridad.admin.spec.js
// ---------------------------------------------------------------------------
// Regresiones de las rutas administrativas.
//
// Contexto: /api/admin/purge borraba la base de datos entera sin pedir nada, y
// /api/admin/seed-admin permitía apoderarse de una cuenta ajena reenviando su
// correo. Estos tests fijan el comportamiento correcto para que no vuelva.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Usuario = require('../models/Usuario');
const { createUserAndLogin, crearUsuario, login } = require('./helpers');

describe('DELETE /api/admin/purge', () => {
  it('sin token → 401', async () => {
    const res = await request(app).delete('/api/admin/purge');

    expect(res.status).toBe(401);
  });

  it('con token de estudiante → 403', async () => {
    const { token } = await createUserAndLogin('estudiante');

    const res = await request(app)
      .delete('/api/admin/purge')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('con token de profesor → 403', async () => {
    const { token } = await createUserAndLogin('profesor');

    const res = await request(app)
      .delete('/api/admin/purge')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('no borra nada cuando la petición no está autorizada', async () => {
    await crearUsuario({ rol: 'estudiante' });

    await request(app).delete('/api/admin/purge').expect(401);

    expect(await Usuario.countDocuments()).toBe(1);
  });

  it('en producción la ruta no existe, ni siquiera para un admin', async () => {
    const { token } = await createUserAndLogin('admin');
    const envOriginal = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .delete('/api/admin/purge')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    } finally {
      process.env.NODE_ENV = envOriginal;
    }

    // Y el usuario sigue ahí.
    expect(await Usuario.countDocuments()).toBe(1);
  });

  // Va al final a propósito: dropDatabase() deja la base sin colecciones.
  it('con token de admin y fuera de producción → 200', async () => {
    const { token } = await createUserAndLogin('admin');

    const res = await request(app)
      .delete('/api/admin/purge')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('POST /api/admin/seed-admin', () => {
  it('crea el admin inicial si no existe', async () => {
    const res = await request(app)
      .post('/api/admin/seed-admin')
      .send({ correo: 'admin@educontrol.com', password: 'admin123', nombre: 'Admin' });

    expect(res.status).toBe(201);

    const admin = await Usuario.findOne({ correo: 'admin@educontrol.com' });
    expect(admin.rol).toBe('admin');
  });

  it('no asciende a admin una cuenta que ya existe', async () => {
    const victima = await crearUsuario({ rol: 'estudiante', password: 'MiClave123' });

    const res = await request(app)
      .post('/api/admin/seed-admin')
      .send({ correo: victima.correo, password: 'AtacanteEligeEsta1' });

    expect(res.status).toBe(200);

    const despues = await Usuario.findById(victima.id);
    expect(despues.rol).toBe('estudiante');
  });

  it('no resetea la contraseña de una cuenta que ya existe', async () => {
    const victima = await crearUsuario({ rol: 'admin', password: 'MiClave123' });

    await request(app)
      .post('/api/admin/seed-admin')
      .send({ correo: victima.correo, password: 'AtacanteEligeEsta1' });

    // La contraseña del atacante no sirve...
    const intentoAtacante = await request(app)
      .post('/api/auth/login')
      .send({ correo: victima.correo, contraseña: 'AtacanteEligeEsta1' });
    // 401 desde que el login dejó de distinguir "correo no registrado" de
    // "contraseña incorrecta": ahora es una sola respuesta para las dos ramas.
    expect(intentoAtacante.status).toBe(401);

    // ...y la original sigue siendo válida.
    await expect(login(victima.correo, 'MiClave123')).resolves.toEqual(expect.any(String));
  });

  it('en producción la ruta no existe', async () => {
    const envOriginal = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .post('/api/admin/seed-admin')
        .send({ correo: 'admin@educontrol.com', password: 'admin123' });

      expect(res.status).toBe(404);
    } finally {
      process.env.NODE_ENV = envOriginal;
    }

    expect(await Usuario.countDocuments()).toBe(0);
  });
});
