// __tests__/seguridad.inscripciones.autorizacion.spec.js
// ---------------------------------------------------------------------------
// `POST /api/inscripciones` se montaba con `validateJWT` a secas y el
// controlador no miraba en ningún punto quién pedía qué: cualquier usuario
// autenticado podía matricular a cualquier otro en cualquier curso.
//
// Lo llamativo es que el código YA distinguía el caso, unas líneas más abajo,
// para decidir si lo apuntaba en auditoría. La misma comparación, antes,
// cierra el fallo.
//
// La regla:
//   admin       a cualquiera, en cualquier curso.
//   profesor    a cualquiera, pero SOLO en los cursos que imparte.
//   estudiante  solo a sí mismo.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const { createUserAndLogin, uniqueEmail } = require('./helpers');

const matricular = (token, cuerpo) =>
  request(app).post('/api/inscripciones').set('Authorization', `Bearer ${token}`).send(cuerpo);

/** Dos profesores con un curso cada uno, dos alumnos y un admin. */
async function escenario() {
  const ana = await createUserAndLogin('profesor', { nombre: 'Ana' });
  const bruno = await createUserAndLogin('profesor', { nombre: 'Bruno' });
  const admin = await createUserAndLogin('admin');

  const cursoDeAna = await Curso.create({ nombre: 'Curso de Ana', profesor: ana.id });
  const cursoDeBruno = await Curso.create({ nombre: 'Curso de Bruno', profesor: bruno.id });

  const nuria = await createUserAndLogin('estudiante', { nombre: 'Nuria' });
  const diego = await createUserAndLogin('estudiante', { nombre: 'Diego' });

  return { ana, bruno, admin, cursoDeAna, cursoDeBruno, nuria, diego };
}

const cuantas = curso => Inscripcion.countDocuments({ curso: curso._id });

describe('Un estudiante solo se matricula a sí mismo', () => {
  it('a otro por identificador: 403, y el otro NO queda matriculado', async () => {
    const { cursoDeAna, nuria, diego } = await escenario();

    const { body } = await matricular(nuria.token, {
      cursoId: String(cursoDeAna._id),
      estudianteId: diego.id,
    }).expect(403);

    expect(body.ok).toBe(false);
    // El efecto, no solo el código: nadie ha quedado dentro.
    expect(await cuantas(cursoDeAna)).toBe(0);
    expect(await Inscripcion.countDocuments({ estudiante: diego.id })).toBe(0);
  });

  it('a sí mismo con su identificador: 201', async () => {
    const { cursoDeAna, nuria } = await escenario();

    await matricular(nuria.token, {
      cursoId: String(cursoDeAna._id),
      estudianteId: nuria.id,
    }).expect(201);

    expect(await cuantas(cursoDeAna)).toBe(1);
  });

  it('a sí mismo SIN identificador: 201, que es lo que manda la pantalla', async () => {
    const { cursoDeAna, nuria } = await escenario();

    await matricular(nuria.token, { cursoId: String(cursoDeAna._id) }).expect(201);

    const [inscripcion] = await Inscripcion.find({ curso: cursoDeAna._id });
    expect(String(inscripcion.estudiante)).toBe(nuria.id);
  });

  it('con su propio correo también: sigue siendo él', async () => {
    const { cursoDeAna, nuria } = await escenario();

    await matricular(nuria.token, {
      cursoId: String(cursoDeAna._id),
      correo: nuria.correo.toUpperCase(),
    }).expect(201);

    expect(await cuantas(cursoDeAna)).toBe(1);
  });
});

describe('Y no puede usar la ruta para averiguar qué correos existen', () => {
  it('el correo de un tercero da 403, exista o no exista', async () => {
    const { cursoDeAna, nuria, diego } = await escenario();
    const cuerpo = correo => ({ cursoId: String(cursoDeAna._id), correo });

    const existente = await matricular(nuria.token, cuerpo(diego.correo)).expect(403);
    const inventado = await matricular(nuria.token, cuerpo(uniqueEmail('nadie'))).expect(403);
    const noEsEstudiante = await matricular(nuria.token, cuerpo('otro@' + 'x.com')).expect(403);

    // Palabra por palabra la misma respuesta: es la enumeración de correos que
    // se cerró en el login, entrando por otra puerta. Sin esto, un estudiante
    // distinguiría "no hay ninguna cuenta con ese correo" (404) de "esa cuenta
    // no es de un estudiante" (400) de un 201.
    expect(inventado.body).toEqual(existente.body);
    expect(noEsEstudiante.body).toEqual(existente.body);
    expect(await cuantas(cursoDeAna)).toBe(0);
  });
});

describe('Un profesor matricula, pero solo en sus cursos', () => {
  it('en el suyo: 201', async () => {
    const { ana, cursoDeAna, nuria } = await escenario();

    await matricular(ana.token, {
      cursoId: String(cursoDeAna._id),
      correo: nuria.correo,
    }).expect(201);

    expect(await cuantas(cursoDeAna)).toBe(1);
  });

  it('en el de otro: 403, y sin matricular a nadie', async () => {
    const { ana, cursoDeBruno, nuria } = await escenario();

    const { body } = await matricular(ana.token, {
      cursoId: String(cursoDeBruno._id),
      correo: nuria.correo,
    }).expect(403);

    expect(body.msg).toMatch(/impartes/i);
    expect(await cuantas(cursoDeBruno)).toBe(0);
  });

  it('tampoco por identificador en el de otro', async () => {
    const { ana, cursoDeBruno, nuria } = await escenario();

    await matricular(ana.token, {
      cursoId: String(cursoDeBruno._id),
      estudianteId: nuria.id,
    }).expect(403);

    expect(await cuantas(cursoDeBruno)).toBe(0);
  });
});

describe('Un administrador, en cualquiera de los dos', () => {
  it('en el curso de Ana y en el de Bruno', async () => {
    const { admin, cursoDeAna, cursoDeBruno, nuria, diego } = await escenario();

    await matricular(admin.token, {
      cursoId: String(cursoDeAna._id),
      estudianteId: nuria.id,
    }).expect(201);

    await matricular(admin.token, {
      cursoId: String(cursoDeBruno._id),
      estudianteId: diego.id,
    }).expect(201);

    expect(await cuantas(cursoDeAna)).toBe(1);
    expect(await cuantas(cursoDeBruno)).toBe(1);
  });
});

describe('Lo que no cambia', () => {
  it('un curso que no existe sigue siendo 404, antes de mirar permisos', async () => {
    const { nuria } = await escenario();

    await matricular(nuria.token, {
      cursoId: '000000000000000000000000',
      estudianteId: nuria.id,
    }).expect(404);
  });

  it('el profesor sigue viendo el 404 de un correo que no existe', async () => {
    const { ana, cursoDeAna } = await escenario();

    const { body } = await matricular(ana.token, {
      cursoId: String(cursoDeAna._id),
      correo: uniqueEmail('nadie'),
    }).expect(404);

    // A él sí hay que decírselo: está corrigiendo una errata, y unificar el
    // mensaje le dejaría sin saber cuál de las dos cosas pasa.
    expect(body.msg).toMatch(/correo/i);
  });

  it('y el 400 de una cuenta que no es de un estudiante', async () => {
    const { ana, bruno, cursoDeAna } = await escenario();

    await matricular(ana.token, {
      cursoId: String(cursoDeAna._id),
      correo: bruno.correo,
    }).expect(400);
  });
});
