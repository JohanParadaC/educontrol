// __tests__/config.seed.spec.js
// ---------------------------------------------------------------------------
// El sembrado del administrador inicial busca por correo, y era el único de los
// cinco sitios que lo hacen sin pasar por utils/correo.js.
//
// Ojo con lo que prueba cada caso: la idempotencia con ADMIN_EMAIL en
// mayúsculas ya funcionaba antes del arreglo, pero de rebote —el esquema
// declara lowercase y Mongoose aplica ese setter también al filtro—. Está aquí
// para que siga funcionando el día que ese detalle del ORM cambie. Lo que sí
// distingue el antes del después es el aviso de la consola: decía el correo
// como venía escrito en el entorno, no como queda guardado, que es el que hay
// que teclear para entrar.
// ---------------------------------------------------------------------------
const Usuario = require('../models/Usuario');
const { ensureAdminSeed } = require('../config/seed');

const ENTORNO = { ...process.env };

describe('Sembrado del admin inicial', () => {
  let salida;

  beforeEach(() => {
    salida = { log: [], warn: [], error: [] };
    for (const nivel of ['log', 'warn', 'error']) {
      jest
        .spyOn(console, nivel)
        .mockImplementation((...args) => salida[nivel].push(args.join(' ')));
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...ENTORNO };
  });

  it('con el correo en mayúsculas y con espacios, dos llamadas dejan una sola cuenta', async () => {
    process.env.ADMIN_EMAIL = '  Admin@Centro.com  ';
    process.env.ADMIN_PASSWORD = 'Secreta123*';

    await ensureAdminSeed();
    await ensureAdminSeed();

    const admins = await Usuario.find({ rol: 'admin' }).lean();
    expect(admins).toHaveLength(1);
    expect(admins[0].correo).toBe('admin@centro.com');
  });

  it('la segunda llamada no escribe nada ni se queja', async () => {
    process.env.ADMIN_EMAIL = 'Admin@Centro.com';
    process.env.ADMIN_PASSWORD = 'Secreta123*';

    await ensureAdminSeed();
    const creado = await Usuario.findOne({ rol: 'admin' }).lean();

    salida.log = [];
    await ensureAdminSeed();

    const despues = await Usuario.findOne({ rol: 'admin' }).lean();
    expect(String(despues._id)).toBe(String(creado._id));
    expect(despues.updatedAt).toEqual(creado.updatedAt);
    expect(salida.error).toEqual([]);
    expect(salida.log.join('\n')).toMatch(/ya existe/i);
  });

  it('el aviso nombra el correo tal y como queda guardado', async () => {
    process.env.ADMIN_EMAIL = '  Admin@Centro.com  ';
    process.env.ADMIN_PASSWORD = 'Secreta123*';

    await ensureAdminSeed();
    await ensureAdminSeed();

    // Quien lee el log tiene que ver el correo con el que se entra, no el que
    // venía escrito en el .env.
    const todo = salida.log.join('\n');
    expect(todo).toContain('admin@centro.com');
    expect(todo).not.toContain('Admin@Centro.com');
  });

  it('la cuenta creada sirve para entrar escribiendo el correo en minúsculas', async () => {
    process.env.ADMIN_EMAIL = 'Admin@Centro.com';
    process.env.ADMIN_PASSWORD = 'Secreta123*';

    await ensureAdminSeed();

    const bcrypt = require('bcryptjs');
    const cuenta = await Usuario.findOne({ correo: 'admin@centro.com' });
    expect(cuenta).not.toBeNull();
    expect(await bcrypt.compare('Secreta123*', cuenta.contraseña)).toBe(true);
  });

  it('no pisa una cuenta que ya existe con ese correo y otro rol', async () => {
    await Usuario.create({
      nombre: 'Ana',
      correo: 'admin@centro.com',
      ['contraseña']: 'x'.repeat(60),
      rol: 'estudiante',
    });

    process.env.ADMIN_EMAIL = 'ADMIN@CENTRO.COM';
    process.env.ADMIN_PASSWORD = 'Secreta123*';
    await ensureAdminSeed();

    const cuentas = await Usuario.find({}).lean();
    expect(cuentas).toHaveLength(1);
    expect(cuentas[0].rol).toBe('estudiante');
    expect(salida.error).toEqual([]);
  });

  it('en producción sin ADMIN_PASSWORD no siembra, y lo dice', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_EMAIL = 'Admin@Centro.com';
    delete process.env.ADMIN_PASSWORD;

    await ensureAdminSeed();

    expect(await Usuario.countDocuments()).toBe(0);
    expect(salida.warn.join('\n')).toMatch(/ADMIN_PASSWORD/);
  });
});
