// __tests__/cursos.detalle.spec.js
// ---------------------------------------------------------------------------
// GET /api/cursos/:id es lo que pinta la ficha del curso, y ahí conviven dos
// datos con permisos distintos:
//
//   `matriculados`  → cuántos son. Es un dato del curso, lo ve cualquiera.
//   `estudiantes`   → quiénes son. Solo su profesor o un administrador.
//
// La segunda mitad es la regla de privacidad del Prompt 2 aplicada a otra
// puerta: cerrar `GET /api/inscripciones` y dejar la lista completa colgando
// de la ficha del curso habría sido mover la fuga, no taparla.
// ---------------------------------------------------------------------------
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const { createUserAndLogin } = require('./helpers');

const ficha = (id, token) =>
  request(app).get(`/api/cursos/${id}`).set('Authorization', `Bearer ${token}`);

/** Un curso de Ana con dos alumnos, y un profesor ajeno mirando desde fuera. */
async function escenario() {
  const ana = await createUserAndLogin('profesor', { nombre: 'Ana' });
  const bruno = await createUserAndLogin('profesor', { nombre: 'Bruno' });
  const admin = await createUserAndLogin('admin');

  const curso = await Curso.create({ nombre: 'Álgebra', profesor: ana.id });

  const nuria = await createUserAndLogin('estudiante', { nombre: 'Nuria' });
  const carlos = await createUserAndLogin('estudiante', { nombre: 'Carlos' });

  await Inscripcion.create({ estudiante: nuria.id, curso: curso._id });
  await Inscripcion.create({ estudiante: carlos.id, curso: curso._id });

  return { ana, bruno, admin, curso, nuria, carlos };
}

describe('GET /api/cursos/:id — ficha del curso', () => {
  it('el profesor del curso ve cuántos son y quiénes son', async () => {
    const { ana, curso, carlos, nuria } = await escenario();

    const { body } = await ficha(curso._id, ana.token).expect(200);

    expect(body.matriculados).toBe(2);
    expect(body.estudiantes).toHaveLength(2);
    // Ordenados por nombre: Carlos antes que Nuria.
    expect(body.estudiantes.map(e => e.nombre)).toEqual(['Carlos', 'Nuria']);
    expect(JSON.stringify(body)).toContain(carlos.correo);
    expect(JSON.stringify(body)).toContain(nuria.correo);
  });

  it('el administrador también', async () => {
    const { admin, curso } = await escenario();

    const { body } = await ficha(curso._id, admin.token).expect(200);

    expect(body.matriculados).toBe(2);
    expect(body.estudiantes).toHaveLength(2);
  });

  it('un estudiante matriculado sabe cuántos son, no quiénes', async () => {
    const { curso, nuria, carlos } = await escenario();

    const { body } = await ficha(curso._id, nuria.token).expect(200);

    expect(body.matriculados).toBe(2);
    // Ausente, no vacío: `[]` diría "no hay ninguno", que es otra cosa.
    expect(body.estudiantes).toBeUndefined();
    // Lo que de verdad se filtraría: el correo de un compañero.
    expect(JSON.stringify(body)).not.toContain(carlos.correo);
  });

  it('un profesor ajeno tampoco ve la lista de un curso que no imparte', async () => {
    const { bruno, curso, nuria } = await escenario();

    const { body } = await ficha(curso._id, bruno.token).expect(200);

    expect(body.matriculados).toBe(2);
    expect(body.estudiantes).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(nuria.correo);
  });

  it('un curso sin alumnos son cero, y su profesor ve la lista vacía', async () => {
    const ana = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Curso nuevo', profesor: ana.id });

    const { body } = await ficha(curso._id, ana.token).expect(200);

    expect(body.matriculados).toBe(0);
    expect(body.estudiantes).toEqual([]);
  });

  it('un id que no existe es 404, no una ficha en blanco', async () => {
    const { token } = await createUserAndLogin('estudiante');
    const inexistente = new mongoose.Types.ObjectId();

    const { body } = await ficha(inexistente, token).expect(404);

    expect(body.ok).toBe(false);
  });

  it('un id mal formado es 400, no un 500', async () => {
    const { token } = await createUserAndLogin('estudiante');

    await ficha('no-es-un-id', token).expect(400);
  });

  it('sin token no se ve nada', async () => {
    const { curso } = await escenario();

    await request(app).get(`/api/cursos/${curso._id}`).expect(401);
  });
});
