// __tests__/config.env.spec.js
// ---------------------------------------------------------------------------
// verificarEntorno decide, al arrancar, qué pasa cuando faltan secretos.
// Es código que solo se ejecuta fuera de los tests, así que hay que invocarlo
// a mano: sin esto quedaba al 20 % de cobertura y sus ramas de producción
// —las que deciden si el servidor arranca o no— no las probaba nadie.
// ---------------------------------------------------------------------------
const { verificarEntorno } = require('../config/env');

/** Un secreto que sí sirve en producción: 64 caracteres y no es el de desarrollo. */
const SECRETO_BUENO = 'a3f9'.repeat(16);

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

    it('con JWT_EXPIRES_IN inválida avisa y cae a la duración por defecto', () => {
      process.env.JWT_EXPIRES_IN = '12 horas';

      verificarEntorno();

      expect(salidas).toEqual([]);
      expect(process.env.JWT_EXPIRES_IN).toBe('12h');
      expect(avisos.join(' ')).toContain('JWT_EXPIRES_IN');
    });

    it('un secreto corto en desarrollo no molesta a nadie', () => {
      process.env.JWT_SECRET = 'x';

      verificarEntorno();

      expect(salidas).toEqual([]);
      expect(process.env.JWT_SECRET).toBe('x');
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

    it('con un JWT_SECRET de juguete aborta: existir no es valer', () => {
      process.env.JWT_SECRET = 'x';

      verificarEntorno();

      // `JWT_SECRET=x` pasaba la validación y firmaba tokens que se rompen a
      // martillazos: solo se comprobaba que la variable estuviera puesta.
      expect(salidas).toEqual([1]);
      expect(avisos.join(' ')).toContain('JWT_SECRET');
    });

    it('rechaza el secreto de desarrollo aunque venga escrito a mano', () => {
      process.env.JWT_SECRET = 'dev-only-no-usar-en-produccion';

      verificarEntorno();

      // Está en el repositorio y en los .env.example: copiarlo al servidor es
      // dejar el secreto publicado.
      expect(salidas).toEqual([1]);
      expect(avisos.join(' ')).toMatch(/desarrollo/i);
    });

    it('con un secreto largo de verdad no se queja', () => {
      process.env.JWT_SECRET = SECRETO_BUENO;
      process.env.PROFESOR_CLAVE = 'la-mia';

      verificarEntorno();

      expect(salidas).toEqual([]);
    });

    it('con JWT_EXPIRES_IN inválida aborta el arranque', () => {
      process.env.JWT_SECRET = SECRETO_BUENO;
      process.env.JWT_EXPIRES_IN = '12 horas';

      verificarEntorno();

      // Sin esto no revienta al arrancar: revienta en el primer login, con un
      // 500 y sin ninguna pista de por qué.
      expect(salidas).toEqual([1]);
      expect(avisos.join(' ')).toContain('JWT_EXPIRES_IN');
    });

    it('una duración que caduca al instante también aborta', () => {
      process.env.JWT_SECRET = SECRETO_BUENO;
      process.env.JWT_EXPIRES_IN = '0';

      verificarEntorno();

      // `jwt.sign` la acepta sin protestar, así que una regla escrita a mano no
      // la habría visto: el token nace vencido y ninguna sesión funciona.
      expect(salidas).toEqual([1]);
    });

    it('las duraciones raras pero válidas se dejan pasar', () => {
      process.env.JWT_SECRET = SECRETO_BUENO;
      process.env.PROFESOR_CLAVE = 'la-mia';

      // '12 h' con espacio es válido para `ms` y una expresión regular escrita
      // a ojo lo habría rechazado. Por eso la comprobación firma un token de
      // verdad en vez de adivinar la gramática.
      for (const valor of ['12h', '12 h', '30m', '7d', '3600']) {
        process.env.JWT_EXPIRES_IN = valor;
        verificarEntorno();
        expect(process.env.JWT_EXPIRES_IN).toBe(valor);
      }

      expect(salidas).toEqual([]);
    });

    it('sin PROFESOR_CLAVE solo avisa, no aborta', () => {
      process.env.JWT_SECRET = SECRETO_BUENO;
      delete process.env.PROFESOR_CLAVE;

      verificarEntorno();

      expect(salidas).toEqual([]);
      expect(process.env.PROFESOR_CLAVE).toBeUndefined();
      expect(avisos.join(' ')).toContain('PROFESOR_CLAVE');
    });
  });
});
