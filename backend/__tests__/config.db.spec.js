// __tests__/config.db.spec.js
// ---------------------------------------------------------------------------
// resolveUri decide a qué Mongo nos conectamos: es lo que hace que el proyecto
// arranque sin instalar nada en local y, a la vez, lo que impide que producción
// acabe apuntando a 127.0.0.1 por descuido.
//
// Se prueba la decisión, no la conexión: abrir conexiones reales aquí haría la
// suite lenta y dejaría procesos vivos.
// ---------------------------------------------------------------------------
const { resolveUri } = require('../config/db');

describe('config/db — resolveUri', () => {
  const original = { ...process.env };

  const sinUris = () => {
    delete process.env.MONGO_CNN;
    delete process.env.MONGO_URI;
    delete process.env.MONGODB_URI;
  };

  afterEach(() => { process.env = { ...original }; });

  it('la URI pasada por parámetro manda sobre todo lo demás', () => {
    process.env.MONGO_URI = 'mongodb://del-entorno/x';

    expect(resolveUri('mongodb://del-parametro/y')).toBe('mongodb://del-parametro/y');
  });

  it('usa MONGO_CNN si está (es la que inyectaba el proveedor de hosting)', () => {
    sinUris();
    process.env.MONGO_CNN = 'mongodb://cnn/x';

    expect(resolveUri()).toBe('mongodb://cnn/x');
  });

  it('acepta MONGO_URI y MONGODB_URI como alternativas', () => {
    sinUris();
    process.env.MONGO_URI = 'mongodb://uri/x';
    expect(resolveUri()).toBe('mongodb://uri/x');

    sinUris();
    process.env.MONGODB_URI = 'mongodb://mongodb-uri/x';
    expect(resolveUri()).toBe('mongodb://mongodb-uri/x');
  });

  it('fuera de producción cae a localhost', () => {
    sinUris();
    process.env.NODE_ENV = 'development';

    expect(resolveUri()).toContain('127.0.0.1');
  });

  it('en producción, sin URI configurada, lanza en vez de caer a localhost', () => {
    sinUris();
    process.env.NODE_ENV = 'production';

    // Arrancar producción contra la base local de la máquina sería peor que
    // no arrancar: el fallo aparecería tarde y con datos de por medio.
    expect(() => resolveUri()).toThrow(/URI de Mongo/i);
  });

  it('en producción con URI configurada, la usa sin protestar', () => {
    sinUris();
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb+srv://atlas/x';

    expect(resolveUri()).toBe('mongodb+srv://atlas/x');
  });
});

describe('config/memoryDb', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  it('en producción no levanta ninguna base en memoria', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    const { iniciarMongoEnMemoria, usandoMongoEnMemoria } = require('../config/memoryDb');

    // Datos efímeros en producción sería peor que no arrancar.
    await expect(iniciarMongoEnMemoria()).resolves.toBeNull();
    expect(usandoMongoEnMemoria()).toBe(false);
  });

  it('detenerla sin haberla iniciado no falla', async () => {
    jest.resetModules();
    const { detenerMongoEnMemoria } = require('../config/memoryDb');

    await expect(detenerMongoEnMemoria()).resolves.toBeUndefined();
  });
});
