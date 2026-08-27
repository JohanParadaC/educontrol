// __tests__/inscripciones.por-correo.spec.js
// ---------------------------------------------------------------------------
// POST /api/inscripciones acepta `correo` en lugar de `estudianteId`.
//
// Existe por la ficha del curso: un profesor puede matricular a alguien en su
// clase, pero para elegirlo de un desplegable habría que abrirle
// `GET /api/usuarios`, que hoy es solo de administrador. Eso le entregaría el
// nombre y el correo de todos los estudiantes del centro para resolver un
// caso en el que ya conoce a la persona. Por correo, hay que saberlo antes.
//
// Lo que NO cambia: sigue haciendo falta que el curso exista y que la cuenta
// sea de un estudiante.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const { createUserAndLogin } = require('./helpers');

const matricular = (token, body) =>
  request(app).post('/api/inscripciones').set('Authorization', `Bearer ${token}`).send(body);

async function escenario() {
  const ana = await createUserAndLogin('profesor', { nombre: 'Ana' });
  const curso = await Curso.create({ nombre: 'Geometría', profesor: ana.id });
  const alumno = await createUserAndLogin('estudiante', { nombre: 'Nuria' });
  return { ana, curso, alumno };
}

describe('POST /api/inscripciones — matricular por correo', () => {
  it('el profesor matricula en su curso escribiendo el correo', async () => {
    const { ana, curso, alumno } = await escenario();

    await matricular(ana.token, { cursoId: String(curso._id), correo: alumno.correo }).expect(201);

    const inscripciones = await Inscripcion.find({ curso: curso._id });
    expect(inscripciones).toHaveLength(1);
    expect(String(inscripciones[0].estudiante)).toBe(alumno.id);
  });

  it('el correo se busca normalizado: mayúsculas y espacios dan igual', async () => {
    const { ana, curso, alumno } = await escenario();

    await matricular(ana.token, {
      cursoId: String(curso._id),
      correo: `  ${alumno.correo.toUpperCase()} `,
    }).expect(201);

    expect(await Inscripcion.countDocuments({ curso: curso._id })).toBe(1);
  });

  it('un correo que no existe es 404 y lo dice', async () => {
    const { ana, curso } = await escenario();

    const { body } = await matricular(ana.token, {
      cursoId: String(curso._id),
      correo: 'nadie@educontrol.com',
    }).expect(404);

    expect(body.msg).toMatch(/correo/i);
    expect(await Inscripcion.countDocuments({ curso: curso._id })).toBe(0);
  });

  it('el correo de alguien que no es estudiante es 400', async () => {
    const { ana, curso } = await escenario();
    const otroProfesor = await createUserAndLogin('profesor');

    await matricular(ana.token, {
      cursoId: String(curso._id),
      correo: otroProfesor.correo,
    }).expect(400);

    expect(await Inscripcion.countDocuments({ curso: curso._id })).toBe(0);
  });

  it('matricular dos veces al mismo sigue siendo 400', async () => {
    const { ana, curso, alumno } = await escenario();

    await matricular(ana.token, { cursoId: String(curso._id), correo: alumno.correo }).expect(201);
    await matricular(ana.token, { cursoId: String(curso._id), correo: alumno.correo }).expect(400);

    expect(await Inscripcion.countDocuments({ curso: curso._id })).toBe(1);
  });

  it('sin estudianteId ni correo es 400, no un 500', async () => {
    const { ana, curso } = await escenario();

    await matricular(ana.token, { cursoId: String(curso._id) }).expect(400);
  });

  it('un correo con formato inválido es 400', async () => {
    const { ana, curso } = await escenario();

    await matricular(ana.token, { cursoId: String(curso._id), correo: 'esto-no-es' }).expect(400);
  });
});
