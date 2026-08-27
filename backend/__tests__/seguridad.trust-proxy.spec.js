// __tests__/seguridad.trust-proxy.spec.js
// ---------------------------------------------------------------------------
// `trust proxy` decide qué considera Express que es `req.ip`, y esa es la clave
// con la que cuenta el freno del login (IP + correo).
//
// Sin configurarlo, detrás de un proxy todas las peticiones llegan con la IP
// del proxy: el freno degrada de IP+correo a solo correo, así que basta con que
// alguien falle cinco veces con un correo ajeno para dejar fuera al dueño de esa
// cuenta desde cualquier sitio. Con los saltos puestos, cada IP real cuenta
// aparte.
//
// El freno general se salta en test (`skip: esTest`), pero el del login sigue
// activo — por eso el caso se prueba contra el login y no contra otra ruta.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const { saltosDeProxy } = require('../config/env');
const { crearUsuario, uniqueEmail } = require('./helpers');

/** Un intento fallido desde la IP que diga la cabecera. */
const intentar = (correo, ip) =>
  request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', ip)
    .send({ correo, contraseña: 'esta-no-es' });

describe('trust proxy y el freno del login', () => {
  // Cada caso usa un correo distinto, así que los contadores no se pisan entre
  // tests aunque el almacén del limitador sea el mismo: la clave lleva el
  // correo dentro.
  const comoEstaba = app.get('trust proxy');
  afterEach(() => app.set('trust proxy', comoEstaba));

  it('con un salto de proxy, cada IP real tiene su propio contador', async () => {
    const correo = uniqueEmail('proxy');
    await crearUsuario({ correo });
    app.set('trust proxy', 1);

    // Cinco fallos desde la misma IP agotan el cupo de ESA IP.
    for (let i = 0; i < 5; i++) {
      await intentar(correo, '203.0.113.10').expect(401);
    }
    await intentar(correo, '203.0.113.10').expect(429);

    // Otra IP, el mismo correo: no hereda el bloqueo del vecino.
    await intentar(correo, '198.51.100.20').expect(401);
  });

  it('sin saltos detrás de un proxy, todas comparten contador', async () => {
    const correo = uniqueEmail('proxy');
    await crearUsuario({ correo });
    app.set('trust proxy', 0);

    for (let i = 0; i < 5; i++) {
      await intentar(correo, '203.0.113.10').expect(401);
    }

    // Esto es el fallo que arregla `trust proxy`: una IP distinta llega
    // bloqueada porque para Express todas son la misma — la del proxy.
    await intentar(correo, '198.51.100.20').expect(429);
  });

  it('acertar sigue sin consumir intentos', async () => {
    const correo = uniqueEmail('proxy');
    const { password } = await crearUsuario({ correo });
    app.set('trust proxy', 1);

    for (let i = 0; i < 8; i++) {
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '203.0.113.30')
        .send({ correo, contraseña: password })
        .expect(200);
    }
  });
});

describe('saltosDeProxy', () => {
  const original = process.env.TRUST_PROXY;
  let avisos;

  beforeEach(() => {
    avisos = [];
    jest.spyOn(console, 'warn').mockImplementation(m => avisos.push(String(m)));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (original === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = original;
  });

  it('sin variable, cero saltos y sin ruido', () => {
    delete process.env.TRUST_PROXY;

    expect(saltosDeProxy()).toBe(0);
    expect(avisos).toEqual([]);
  });

  it('un número de saltos se respeta', () => {
    process.env.TRUST_PROXY = '2';

    expect(saltosDeProxy()).toBe(2);
    expect(avisos).toEqual([]);
  });

  it('cualquier otra cosa cae a 0 y avisa', () => {
    // `true` es justo lo que NO queremos: fiarse de la cabecera entera deja que
    // cualquiera se invente su IP y se salte el freno del login.
    for (const valor of ['true', 'sí', '-1', '1.5', 'localhost']) {
      process.env.TRUST_PROXY = valor;
      expect(saltosDeProxy()).toBe(0);
    }
    expect(avisos.length).toBe(5);
    expect(avisos.every(a => a.includes('TRUST_PROXY'))).toBe(true);
  });

  it('la aplicación arranca con los saltos ya puestos', () => {
    // Este es el test que se cae si se quita `app.set('trust proxy', …)` de
    // app.js: el valor por defecto de Express es `false`, no 0. Y tiene que ser
    // un NÚMERO — con `true` Express se creería la cabecera entera, que la pone
    // el cliente.
    expect(app.get('trust proxy')).toBe(0);
    expect(typeof app.get('trust proxy')).toBe('number');
  });
});
