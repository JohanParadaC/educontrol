// __tests__/seguridad.cambio-correo.spec.js
// ---------------------------------------------------------------------------
// Cambiar el PROPIO correo exige la contraseña actual, igual que cambiar la
// contraseña.
//
// La asimetría venía de la primera auditoría: el bloque de reautenticación
// protegía `contraseña` y `correo` se aplicaba sin comprobar nada. Y el
// razonamiento que justifica reautenticar —"una sesión olvidada abierta un
// minuto basta para que un tercero se quede la cuenta"— vale igual para el
// correo, que ES el identificador con el que se entra.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Auditoria = require('../models/Auditoria');
const Usuario = require('../models/Usuario');
const { createUserAndLogin, crearUsuario, login, uniqueEmail } = require('./helpers');

const put = (id, token, body) =>
  request(app).put(`/api/usuarios/${id}`).set('Authorization', `Bearer ${token}`).send(body);

const correoDe = async id => (await Usuario.findById(id).select('correo'))?.correo;

describe('PUT /api/usuarios/:id — cambio del propio correo', () => {
  it('sin la contraseña actual → 400 y el correo sigue siendo el viejo', async () => {
    const yo = await createUserAndLogin('estudiante', { password: 'MiClave123' });
    const nuevo = uniqueEmail('nuevo');

    const res = await put(yo.id, yo.token, { correo: nuevo });

    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/contraseña actual/i);
    expect(await correoDe(yo.id)).toBe(yo.correo);
    // Y se sigue entrando con el de siempre.
    await expect(login(yo.correo, 'MiClave123')).resolves.toEqual(expect.any(String));
  });

  it('con la contraseña equivocada → 403 y no se cambia nada', async () => {
    const yo = await createUserAndLogin('estudiante', { password: 'MiClave123' });
    const nuevo = uniqueEmail('nuevo');

    const res = await put(yo.id, yo.token, { contraseñaActual: 'NO-ES-ESTA', correo: nuevo });

    expect(res.status).toBe(403);
    expect(await correoDe(yo.id)).toBe(yo.correo);

    // El correo que quería imponer no sirve para entrar...
    const conElNuevo = await request(app)
      .post('/api/auth/login')
      .send({ correo: nuevo, contraseña: 'MiClave123' });
    expect(conElNuevo.status).toBe(401);

    // ...y el antiguo sigue valiendo.
    await expect(login(yo.correo, 'MiClave123')).resolves.toEqual(expect.any(String));
  });

  it('con la contraseña correcta → 200, y a partir de ahí se entra con el nuevo', async () => {
    const yo = await createUserAndLogin('estudiante', { password: 'MiClave123' });
    const nuevo = uniqueEmail('nuevo');

    const res = await put(yo.id, yo.token, { contraseñaActual: 'MiClave123', correo: nuevo });

    expect(res.status).toBe(200);

    await expect(login(nuevo, 'MiClave123')).resolves.toEqual(expect.any(String));

    const conElViejo = await request(app)
      .post('/api/auth/login')
      .send({ correo: yo.correo, contraseña: 'MiClave123' });
    expect(conElViejo.status).toBe(401);
  });

  it('cambiarse solo el nombre NO pide la contraseña', async () => {
    const yo = await createUserAndLogin('estudiante', { password: 'MiClave123' });

    const res = await put(yo.id, yo.token, { nombre: 'Nombre Nuevo' });

    expect(res.status).toBe(200);
    expect(res.body.usuario.nombre).toBe('Nombre Nuevo');
  });

  it('mandar el mismo correo que ya tienes no cuenta como cambio', async () => {
    const yo = await createUserAndLogin('estudiante', { password: 'MiClave123' });

    // El formulario de "Mi cuenta" manda nombre y correo juntos: sin esto,
    // cambiarse el nombre pediría la contraseña.
    const res = await put(yo.id, yo.token, {
      nombre: 'Otro Nombre',
      correo: yo.correo.toUpperCase(),
    });

    expect(res.status).toBe(200);
    expect(await correoDe(yo.id)).toBe(yo.correo);
  });

  it('un admin cambia el correo de un tercero sin dar ninguna contraseña', async () => {
    const admin = await createUserAndLogin('admin');
    const otro = await crearUsuario({ rol: 'estudiante', password: 'SuClave123' });
    const nuevo = uniqueEmail('reasignado');

    const res = await put(otro.id, admin.token, { correo: nuevo });

    expect(res.status).toBe(200);
    expect(await correoDe(otro.id)).toBe(nuevo);
    await expect(login(nuevo, 'SuClave123')).resolves.toEqual(expect.any(String));
  });

  it('el cambio de correo queda en el historial, con el de antes y el de después', async () => {
    const admin = await createUserAndLogin('admin');
    const otro = await crearUsuario({ rol: 'estudiante', nombre: 'Diego' });
    const nuevo = uniqueEmail('reasignado');

    await put(otro.id, admin.token, { correo: nuevo });

    const registro = await Auditoria.findOne({ accion: 'usuario.correo' }).lean();
    expect(registro).not.toBeNull();
    expect(registro.recurso.etiqueta).toBe('Diego');
    expect(registro.antes.correo).toBe(otro.correo);
    expect(registro.despues.correo).toBe(nuevo);
  });

  it('un cambio que NO llega a ocurrir no se registra', async () => {
    const yo = await createUserAndLogin('estudiante', { password: 'MiClave123' });

    await put(yo.id, yo.token, { correo: uniqueEmail('fallido') });

    expect(await Auditoria.countDocuments({ accion: 'usuario.correo' })).toBe(0);
  });
});
