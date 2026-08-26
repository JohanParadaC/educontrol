// __tests__/seguridad.http.spec.js
// ---------------------------------------------------------------------------
// La superficie HTTP: qué se puede averiguar sin credenciales y qué cabeceras
// salen por la puerta.
//
// - El login distinguía "correo no registrado" de "Contraseña incorrecta", así
//   que se podía averiguar qué correos existen sin acertar ni una contraseña.
// - No había límite de intentos: fuerza bruta ilimitada.
// - No había helmet: ni nosniff, ni CSP, ni frame-ancestors. La SPA se podía
//   incrustar en un iframe ajeno.
// - `app.use(cors())` abría la API a cualquier origen sin que hiciera falta:
//   el backend sirve el propio frontend.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const errorHandler = require('../middlewares/errorHandler');
const { crearUsuario, uniqueEmail, PASSWORD_POR_DEFECTO } = require('./helpers');

const intentarLogin = (correo, contraseña) =>
  request(app).post('/api/auth/login').send({ correo, contraseña });

describe('POST /api/auth/login — sin enumeración de usuarios', () => {
  it('correo inexistente y contraseña equivocada dan exactamente la misma respuesta', async () => {
    const existente = await crearUsuario({ rol: 'estudiante' });

    const noExiste = await intentarLogin(uniqueEmail('fantasma'), 'LaQueSea123');
    const passMala = await intentarLogin(existente.correo, 'NoEsSuContraseña1');

    expect(noExiste.status).toBe(401);
    expect(passMala.status).toBe(401);
    // Mismo cuerpo, palabra por palabra: si difieren, la diferencia es el dato
    // que se filtra.
    expect(noExiste.body).toEqual(passMala.body);
    expect(noExiste.body.msg).toBe('Correo o contraseña incorrectos');
  });

  it('el mensaje no dice si el correo está registrado', async () => {
    const res = await intentarLogin(uniqueEmail('nadie'), 'LaQueSea123');

    expect(res.body.msg).not.toMatch(/registrad/i);
    expect(res.body.msg).not.toMatch(/no existe/i);
  });

  it('las credenciales correctas siguen entrando', async () => {
    const { correo } = await crearUsuario({ rol: 'estudiante' });

    const res = await intentarLogin(correo, PASSWORD_POR_DEFECTO);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});

describe('POST /api/auth/login — límite de intentos', () => {
  it('el sexto intento fallido devuelve 429', async () => {
    // Correo propio de este caso: la clave del límite es IP + correo, así que
    // así no se lleva por delante al resto de la suite.
    const correo = uniqueEmail('fuerzabruta');

    for (let i = 1; i <= 5; i++) {
      const res = await intentarLogin(correo, 'ContraseñaMala1');
      expect(res.status).toBe(401);
    }

    const sexto = await intentarLogin(correo, 'ContraseñaMala1');

    expect(sexto.status).toBe(429);
    expect(sexto.body.msg).toMatch(/intentos/i);
  });

  it('el freno es por correo: otra cuenta sigue pudiendo intentarlo', async () => {
    const quemado = uniqueEmail('quemado');
    for (let i = 1; i <= 6; i++) await intentarLogin(quemado, 'Mala1234');

    const otro = await intentarLogin(uniqueEmail('otro'), 'Mala1234');

    expect(otro.status).toBe(401);
  });

  it('acertar no consume intentos', async () => {
    const { correo } = await crearUsuario({ rol: 'estudiante' });

    for (let i = 1; i <= 8; i++) {
      await intentarLogin(correo, PASSWORD_POR_DEFECTO).expect(200);
    }
  });
});

describe('Cabeceras de seguridad', () => {
  it('helmet cubre lo básico', async () => {
    const res = await request(app).get('/api/health').expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('no anuncia que es Express', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('la CSP deja pasar los estilos en línea de Material, pero no los scripts', async () => {
    const { headers } = await request(app).get('/api/health');
    const csp = headers['content-security-policy'];

    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('ya no abre la API a orígenes cruzados', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://sitio-ajeno.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('errorHandler — no filtra las tripas de Mongo', () => {
  /** Un `res` mínimo que se queda con lo que le mandan. */
  function resFalso() {
    const res = {
      estado: null,
      cuerpo: null,
      status(codigo) {
        this.estado = codigo;
        return this;
      },
      json(cuerpo) {
        this.cuerpo = cuerpo;
        return this;
      },
    };
    return res;
  }

  const manejar = err => {
    const res = resFalso();
    errorHandler(err, {}, res, () => {});
    return res;
  };

  it('un CastError es un 400, no un 500', () => {
    const res = manejar({
      name: 'CastError',
      message: 'Cast to ObjectId failed for value "abc" at path "_id" for model "Curso"',
    });

    expect(res.estado).toBe(400);
    expect(res.cuerpo.msg).toBe('Identificador no válido');
    // Ni el modelo ni el valor: eso es información de dentro.
    expect(JSON.stringify(res.cuerpo)).not.toContain('Curso');
  });

  it('una clave duplicada es un 409 y dice el campo, no el índice', () => {
    const res = manejar({
      code: 11000,
      message: 'E11000 duplicate key error collection: jest.usuarios index: correo_1 dup key',
      keyPattern: { correo: 1 },
      keyValue: { correo: 'alguien@mail.com' },
    });

    expect(res.estado).toBe(409);
    expect(res.cuerpo.msg).toBe('Ese valor ya existe');
    expect(res.cuerpo.campos).toEqual(['correo']);
    expect(JSON.stringify(res.cuerpo)).not.toContain('E11000');
    expect(JSON.stringify(res.cuerpo)).not.toContain('alguien@mail.com');
  });

  it('un error de validación es un 400 con los campos afectados', () => {
    const res = manejar({
      name: 'ValidationError',
      message: 'Curso validation failed: nombre: Path `nombre` is required.',
      errors: { nombre: {}, profesor: {} },
    });

    expect(res.estado).toBe(400);
    expect(res.cuerpo.campos).toEqual(['nombre', 'profesor']);
  });

  it('en producción un 500 sale genérico', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = manejar(new Error('conexión a mongodb://usuario:clave@host rechazada'));

      expect(res.estado).toBe(500);
      expect(res.cuerpo.msg).toBe('Error interno del servidor');
      expect(res.cuerpo.msg).not.toContain('mongodb');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('un 4xx nuestro conserva su mensaje, que está escrito para leerse', () => {
    const res = manejar({ statusCode: 403, message: 'Este curso no es tuyo' });

    expect(res.estado).toBe(403);
    expect(res.cuerpo.msg).toBe('Este curso no es tuyo');
  });
});

describe('Autenticación — una sola cabecera', () => {
  it('la cabecera legacy x-token ya no vale', async () => {
    const { correo } = await crearUsuario({ rol: 'admin' });
    const { body } = await intentarLogin(correo, PASSWORD_POR_DEFECTO).expect(200);

    const conLegacy = await request(app).get('/api/usuarios').set('x-token', body.token);
    expect(conLegacy.status).toBe(401);

    // Y el mismo token por la vía buena sí entra.
    await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${body.token}`)
      .expect(200);
  });
});
