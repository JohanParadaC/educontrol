// __tests__/inscripciones.crud.spec.js
// ---------------------------------------------------------------------------
// El recurso de inscripciones estaba al 18 % de cobertura: un recurso completo
// sin apenas pruebas. Aquí se cubre el ciclo entero y, sobre todo, las reglas
// de acceso de cada endpoint.
// ---------------------------------------------------------------------------
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const { createUserAndLogin, crearUsuario } = require('./helpers');

const idInexistente = () => new mongoose.Types.ObjectId().toString();

/** Monta un curso con su profesor y devuelve ambos. */
async function crearCurso(nombre = 'Curso de prueba') {
  const profesor = await crearUsuario({ rol: 'profesor' });
  const curso = await Curso.create({ nombre, descripcion: 'demo', profesor: profesor.id });
  return { curso, profesor };
}

const post = (token, body) =>
  request(app).post('/api/inscripciones').set('Authorization', `Bearer ${token}`).send(body);

describe('POST /api/inscripciones', () => {
  it('sin token → 401', async () => {
    const res = await request(app).post('/api/inscripciones').send({});
    expect(res.status).toBe(401);
  });

  it('sin cursoId ni estudianteId → 400', async () => {
    const { token } = await createUserAndLogin('estudiante');

    const res = await post(token, {});

    expect(res.status).toBe(400);
    expect(await Inscripcion.countDocuments()).toBe(0);
  });

  it('inscribe correctamente → 201', async () => {
    const alumno = await createUserAndLogin('estudiante');
    const { curso } = await crearCurso();

    const res = await post(alumno.token, { cursoId: curso._id, estudianteId: alumno.id });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(await Inscripcion.countDocuments()).toBe(1);
  });

  it('rechaza la inscripción duplicada → 400 y no crea una segunda', async () => {
    const alumno = await createUserAndLogin('estudiante');
    const { curso } = await crearCurso();
    const cuerpo = { cursoId: curso._id, estudianteId: alumno.id };

    await post(alumno.token, cuerpo).expect(201);
    const segunda = await post(alumno.token, cuerpo);

    expect(segunda.status).toBe(400);
    expect(await Inscripcion.countDocuments()).toBe(1);
  });

  it('un id de curso con formato inválido no revienta con 500', async () => {
    const alumno = await createUserAndLogin('estudiante');

    const res = await post(alumno.token, { cursoId: 'no-es-un-id', estudianteId: alumno.id });

    // Lo importante es que sea un error de cliente, no un fallo del servidor.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('GET /api/inscripciones', () => {
  it('sin token → 401', async () => {
    expect((await request(app).get('/api/inscripciones')).status).toBe(401);
  });

  it('devuelve la lista con estudiante y curso poblados', async () => {
    const alumno = await createUserAndLogin('estudiante', { nombre: 'Ana Torres' });
    const { curso } = await crearCurso('Angular desde cero');
    await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    const { body } = await request(app)
      .get('/api/inscripciones')
      .set('Authorization', `Bearer ${alumno.token}`)
      .expect(200);

    expect(body.inscripciones).toHaveLength(1);
    // Poblado: sin esto el frontend solo vería identificadores.
    expect(body.inscripciones[0].estudiante.nombre).toBe('Ana Torres');
    expect(body.inscripciones[0].curso.nombre).toBe('Angular desde cero');
  });

  it('nunca expone la contraseña del estudiante', async () => {
    const alumno = await createUserAndLogin('estudiante');
    const { curso } = await crearCurso();
    await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    const { body } = await request(app)
      .get('/api/inscripciones')
      .set('Authorization', `Bearer ${alumno.token}`)
      .expect(200);

    expect(body.inscripciones[0].estudiante).not.toHaveProperty('contraseña');
  });

  it('lista vacía cuando no hay inscripciones', async () => {
    const { token } = await createUserAndLogin('estudiante');

    const { body } = await request(app)
      .get('/api/inscripciones')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.inscripciones).toEqual([]);
  });
});

describe('GET /api/inscripciones/:id', () => {
  it('id con formato inválido → 400', async () => {
    const { token } = await createUserAndLogin('estudiante');

    const res = await request(app)
      .get('/api/inscripciones/xxx')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('id válido pero inexistente → 404', async () => {
    const { token } = await createUserAndLogin('estudiante');

    const res = await request(app)
      .get(`/api/inscripciones/${idInexistente()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('devuelve la inscripción poblada → 200', async () => {
    const alumno = await createUserAndLogin('estudiante');
    const { curso } = await crearCurso('Testing automatizado');
    const ins = await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    const { body } = await request(app)
      .get(`/api/inscripciones/${ins._id}`)
      .set('Authorization', `Bearer ${alumno.token}`)
      .expect(200);

    expect(body.inscripcion.curso.nombre).toBe('Testing automatizado');
  });
});

describe('PUT /api/inscripciones/:id', () => {
  it('un estudiante no puede actualizarla → 403', async () => {
    const alumno = await createUserAndLogin('estudiante');
    const { curso } = await crearCurso();
    const ins = await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    const res = await request(app)
      .put(`/api/inscripciones/${ins._id}`)
      .set('Authorization', `Bearer ${alumno.token}`)
      .send({ curso: curso._id });

    expect(res.status).toBe(403);
  });

  it('un profesor tampoco → 403', async () => {
    const profe = await createUserAndLogin('profesor');
    const alumno = await crearUsuario({ rol: 'estudiante' });
    const { curso } = await crearCurso();
    const ins = await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    const res = await request(app)
      .put(`/api/inscripciones/${ins._id}`)
      .set('Authorization', `Bearer ${profe.token}`)
      .send({ curso: curso._id });

    expect(res.status).toBe(403);
  });

  it('un admin sí, y devuelve la inscripción actualizada → 200', async () => {
    const admin = await createUserAndLogin('admin');
    const alumno = await crearUsuario({ rol: 'estudiante' });
    const { curso } = await crearCurso('Original');
    const otro = await crearCurso('Destino');
    const ins = await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    const { body } = await request(app)
      .put(`/api/inscripciones/${ins._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ curso: otro.curso._id })
      .expect(200);

    expect(body.inscripcion.curso.nombre).toBe('Destino');
  });

  it('inscripción inexistente → 404', async () => {
    const admin = await createUserAndLogin('admin');

    const res = await request(app)
      .put(`/api/inscripciones/${idInexistente()}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/inscripciones/:id', () => {
  it('sin token → 401 y la inscripción sigue ahí', async () => {
    const alumno = await crearUsuario({ rol: 'estudiante' });
    const { curso } = await crearCurso();
    const ins = await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    await request(app).delete(`/api/inscripciones/${ins._id}`).expect(401);

    expect(await Inscripcion.countDocuments()).toBe(1);
  });

  it('un estudiante no puede borrarla → 403 y sigue ahí', async () => {
    const alumno = await createUserAndLogin('estudiante');
    const { curso } = await crearCurso();
    const ins = await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    const res = await request(app)
      .delete(`/api/inscripciones/${ins._id}`)
      .set('Authorization', `Bearer ${alumno.token}`);

    expect(res.status).toBe(403);
    expect(await Inscripcion.countDocuments()).toBe(1);
  });

  it('un admin sí → 200 y desaparece', async () => {
    const admin = await createUserAndLogin('admin');
    const alumno = await crearUsuario({ rol: 'estudiante' });
    const { curso } = await crearCurso();
    const ins = await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    await request(app)
      .delete(`/api/inscripciones/${ins._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(await Inscripcion.countDocuments()).toBe(0);
  });

  it('borrar dos veces la misma → 404 la segunda', async () => {
    const admin = await createUserAndLogin('admin');
    const alumno = await crearUsuario({ rol: 'estudiante' });
    const { curso } = await crearCurso();
    const ins = await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });
    const url = `/api/inscripciones/${ins._id}`;

    await request(app).delete(url).set('Authorization', `Bearer ${admin.token}`).expect(200);
    await request(app).delete(url).set('Authorization', `Bearer ${admin.token}`).expect(404);
  });
});

describe('Regla de negocio: no se puede inscribir dos veces', () => {
  it('el índice único de la base de datos lo impide aunque se salte el controlador', async () => {
    const alumno = await crearUsuario({ rol: 'estudiante' });
    const { curso } = await crearCurso();

    await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    // La comprobación del controlador es una cortesía; la garantía real es el
    // índice compuesto único del modelo.
    await expect(
      Inscripcion.create({ estudiante: alumno.id, curso: curso._id })
    ).rejects.toThrow();
  });
});
