// __tests__/seguridad.inscripciones.alcance.spec.js
// ---------------------------------------------------------------------------
// GET /api/inscripciones hacía `Inscripcion.find()` sin filtro y devolvía
// estudiante y curso poblados. La ruta solo exigía validateJWT, así que
// cualquier estudiante autenticado se llevaba el nombre y el CORREO de todos
// los estudiantes del sistema y en qué cursos estaban.
//
// Además era el único listado del proyecto sin paginar.
//
// Regla que se comprueba aquí:
//   estudiante → solo las suyas
//   profesor   → solo las de los cursos que imparte
//   admin      → todas
// ---------------------------------------------------------------------------
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const { createUserAndLogin, crearUsuario } = require('./helpers');

// Ojo: Usuario.toJSON renombra _id -> id y oculta la contraseña, así que el
// estudiante poblado llega con `id`. El curso, que no tiene toJSON propio,
// conserva `_id`.
const listar = (token, query = '') =>
  request(app).get(`/api/inscripciones${query}`).set('Authorization', `Bearer ${token}`);

/**
 * Dos profesores, un curso cada uno y un alumno matriculado en cada curso.
 * Es el escenario mínimo donde la fuga se ve: el alumno de Ana no debería
 * saber ni que existe el alumno de Bruno.
 */
async function escenario() {
  const ana = await createUserAndLogin('profesor', { nombre: 'Ana' });
  const bruno = await createUserAndLogin('profesor', { nombre: 'Bruno' });

  const cursoDeAna = await Curso.create({ nombre: 'Curso de Ana', profesor: ana.id });
  const cursoDeBruno = await Curso.create({ nombre: 'Curso de Bruno', profesor: bruno.id });

  const alumnoDeAna = await createUserAndLogin('estudiante', { nombre: 'Alumno de Ana' });
  const alumnoDeBruno = await createUserAndLogin('estudiante', { nombre: 'Alumno de Bruno' });

  await Inscripcion.create({ estudiante: alumnoDeAna.id, curso: cursoDeAna._id });
  await Inscripcion.create({ estudiante: alumnoDeBruno.id, curso: cursoDeBruno._id });

  return { ana, bruno, cursoDeAna, cursoDeBruno, alumnoDeAna, alumnoDeBruno };
}

describe('GET /api/inscripciones — alcance por rol', () => {
  it('un estudiante solo ve las suyas y no el correo de nadie más', async () => {
    const { alumnoDeAna, alumnoDeBruno } = await escenario();

    const { body } = await listar(alumnoDeAna.token).expect(200);

    expect(body.inscripciones).toHaveLength(1);
    expect(String(body.inscripciones[0].estudiante.id)).toBe(alumnoDeAna.id);

    // Lo que de verdad se filtraba: los correos ajenos.
    expect(JSON.stringify(body)).not.toContain(alumnoDeBruno.correo);
  });

  it('un profesor solo ve las de los cursos que imparte', async () => {
    const { ana, cursoDeAna, alumnoDeBruno } = await escenario();

    const { body } = await listar(ana.token).expect(200);

    expect(body.inscripciones).toHaveLength(1);
    expect(String(body.inscripciones[0].curso._id)).toBe(String(cursoDeAna._id));
    expect(JSON.stringify(body)).not.toContain(alumnoDeBruno.correo);
  });

  it('un profesor sin cursos no ve nada', async () => {
    await escenario();
    const nuevo = await createUserAndLogin('profesor');

    const { body } = await listar(nuevo.token).expect(200);

    expect(body.inscripciones).toEqual([]);
  });

  it('un admin sí las ve todas', async () => {
    await escenario();
    const admin = await createUserAndLogin('admin');

    const { body } = await listar(admin.token).expect(200);

    expect(body.inscripciones).toHaveLength(2);
  });
});

describe('GET /api/inscripciones — filtros ?curso= y ?estudiante=', () => {
  it('un estudiante que pregunta por otro no obtiene nada', async () => {
    const { alumnoDeAna, alumnoDeBruno } = await escenario();

    const { body } = await listar(alumnoDeAna.token, `?estudiante=${alumnoDeBruno.id}`).expect(200);

    expect(body.inscripciones).toEqual([]);
  });

  it('un profesor que pregunta por un curso ajeno no obtiene nada', async () => {
    const { ana, cursoDeBruno } = await escenario();

    const { body } = await listar(ana.token, `?curso=${cursoDeBruno._id}`).expect(200);

    expect(body.inscripciones).toEqual([]);
  });

  it('un profesor filtrando por su propio curso sí obtiene sus alumnos', async () => {
    const { ana, cursoDeAna } = await escenario();

    const { body } = await listar(ana.token, `?curso=${cursoDeAna._id}`).expect(200);

    expect(body.inscripciones).toHaveLength(1);
  });

  it('un admin puede filtrar por estudiante', async () => {
    const { alumnoDeBruno } = await escenario();
    const admin = await createUserAndLogin('admin');

    const { body } = await listar(admin.token, `?estudiante=${alumnoDeBruno.id}`).expect(200);

    expect(body.inscripciones).toHaveLength(1);
    expect(String(body.inscripciones[0].estudiante.id)).toBe(alumnoDeBruno.id);
  });

  it('un filtro con formato inválido es un 400, no un 500', async () => {
    const admin = await createUserAndLogin('admin');

    const res = await listar(admin.token, '?curso=no-es-un-id');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/inscripciones — paginación', () => {
  it('respeta el tope duro de 100 aunque se pida más', async () => {
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Masivo', profesor: profesor.id });

    // 120 matrículas. Los estudiantes no existen como documentos: aquí solo se
    // mide cuántas filas salen por la puerta, no a quién pertenecen.
    await Inscripcion.insertMany(
      Array.from({ length: 120 }, () => ({
        estudiante: new mongoose.Types.ObjectId(),
        curso: curso._id,
      }))
    );

    const admin = await createUserAndLogin('admin');
    const { body } = await listar(admin.token, '?limit=999999').expect(200);

    expect(body.inscripciones).toHaveLength(100);
    expect(body.limite).toBe(100);
    expect(body.total).toBe(120);
  });

  it('devuelve los metadatos que necesita un paginador', async () => {
    await escenario();
    const admin = await createUserAndLogin('admin');

    const { body } = await listar(admin.token, '?page=1&limit=1').expect(200);

    expect(body.inscripciones).toHaveLength(1);
    expect(body).toMatchObject({ total: 2, pagina: 1, limite: 1, paginas: 2 });
  });
});

describe('GET /api/inscripciones/:id — el mismo alcance', () => {
  it('un estudiante no puede leer la inscripción de otro por su id → 404', async () => {
    const { alumnoDeAna, alumnoDeBruno } = await escenario();
    const ajena = await Inscripcion.findOne({ estudiante: alumnoDeBruno.id });

    const res = await request(app)
      .get(`/api/inscripciones/${ajena._id}`)
      .set('Authorization', `Bearer ${alumnoDeAna.token}`);

    // 404 y no 403: quien no puede verla tampoco sabe si existe.
    expect(res.status).toBe(404);
  });

  it('un estudiante sí puede leer la suya → 200', async () => {
    const { alumnoDeAna } = await escenario();
    const propia = await Inscripcion.findOne({ estudiante: alumnoDeAna.id });

    const res = await request(app)
      .get(`/api/inscripciones/${propia._id}`)
      .set('Authorization', `Bearer ${alumnoDeAna.token}`);

    expect(res.status).toBe(200);
  });
});
