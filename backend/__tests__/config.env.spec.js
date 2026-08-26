// __tests__/config.env.spec.js
// ---------------------------------------------------------------------------
// verificarEntorno decide, al arrancar, qué pasa cuando faltan secretos.
// Es código que solo se ejecuta fuera de los tests, así que hay que invocarlo
// a mano: sin esto quedaba al 20 % de cobertura y sus ramas de producción
// —las que deciden si el servidor arranca o no— no las probaba nadie.
// ---------------------------------------------------------------------------
const { verificarEntorno } = require('../config/env');

describe('verificarEntorno', () => {
  const original = { ...process.env };
  let salidas;
  let avisos;

  beforeEach(() => {
    salidas = [];
    avisos = [];
    jest.spyOn(console, 'warn').mockImplementation(m => avisos.push(String(m)));
    jest.spyOn(console, 'error').mockImplementation(m => avisos.push(String(m)));
    jest.spyOn(process, 'exit').mockImplementation(code => {
      salidas.push(code);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...original };
  });

  describe('en desarrollo', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('rellena JWT_SECRET si falta y avisa', () => {
      delete process.env.JWT_SECRET;

      verificarEntorno();

      expect(process.env.JWT_SECRET).toBeTruthy();
      expect(avisos.join(' ')).toContain('JWT_SECRET');
      expect(salidas).toEqual([]); // no mata el proceso
    });

    it('rellena PROFESOR_CLAVE si falta', () => {
      delete process.env.PROFESOR_CLAVE;

      verificarEntorno();

      expect(process.env.PROFESOR_CLAVE).toBeTruthy();
    });

    it('respeta los valores ya configurados', () => {
      process.env.JWT_SECRET = 'el-mio';
      process.env.PROFESOR_CLAVE = 'la-mia';

      verificarEntorno();

      expect(process.env.JWT_SECRET).toBe('el-mio');
      expect(process.env.PROFESOR_CLAVE).toBe('la-mia');
    });
  });

  describe('en producción', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('sin JWT_SECRET aborta el arranque', () => {
      delete process.env.JWT_SECRET;

      verificarEntorno();

      // Fallar al arrancar es mejor que arrancar y devolver 500 en cada login.
      expect(salidas).toEqual([1]);
      expect(avisos.join(' ')).toContain('JWT_SECRET');
    });

    it('nunca inventa un secreto de desarrollo en producción', () => {
      delete process.env.JWT_SECRET;

      verificarEntorno();

      expect(process.env.JWT_SECRET).toBeUndefined();
    });

    it('sin PROFESOR_CLAVE solo avisa, no aborta', () => {
      process.env.JWT_SECRET = 'secreto-real';
      delete process.env.PROFESOR_CLAVE;

      verificarEntorno();

      expect(salidas).toEqual([]);
      expect(process.env.PROFESOR_CLAVE).toBeUndefined();
      expect(avisos.join(' ')).toContain('PROFESOR_CLAVE');
    });
  });
});
