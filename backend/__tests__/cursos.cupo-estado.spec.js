// __tests__/cursos.cupo-estado.spec.js
// ---------------------------------------------------------------------------
// Un curso tenía título, descripción y profesor, y nada que dijera si admitía
// gente. Ahora tiene `cupoMaximo` (opcional) y `estado`.
//
// Lo que se comprueba: que matricularse en un curso lleno o no abierto devuelve
// 409 y NO crea la matrícula —un mensaje bonito sobre una fila ya creada no
// sirve de nada—, y que archivar saca el curso del catálogo del estudiante sin
// sacarlo del de administración.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const { migrarEstadoDeCursos } = require('../config/migraciones');
const { createUserAndLogin } = require('./helpers');

const matricular = (token, cursoId, estudianteId) =>
  request(app)
    .post('/api/inscripciones')
    .set('Authorization', `Bearer ${token}`)
    .send({ cursoId: String(cursoId), estudianteId: String(estudianteId) });

const catalogo = token =>
  request(app).get('/api/cursos?limit=100').set('Authorization', `Bearer ${token}`);

describe('Cupo de un curso', () => {
  it('sin cupo no hay límite', async () => {
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Sin tope', profesor: profe.id });

    for (let i = 0; i < 3; i++) {
      const alumno = await createUserAndLogin('estudiante');
      await matricular(alumno.token, curso._id, alumno.id).expect(201);
    }

    expect(await Inscripcion.countDocuments({ curso: curso._id })).toBe(3);
  });

  it('la última plaza entra y la siguiente da 409 sin crear nada', async () => {
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Dos plazas', profesor: profe.id, cupoMaximo: 2 });

    const uno = await createUserAndLogin('estudiante');
    const dos = await createUserAndLogin('estudiante');
    const tres = await createUserAndLogin('estudiante');

    await matricular(uno.token, curso._id, uno.id).expect(201);
    await matricular(dos.token, curso._id, dos.id).expect(201);

    const { body } = await matricular(tres.token, curso._id, tres.id).expect(409);

    expect(body.msg).toMatch(/plazas/i);
    expect(body.ocupadas).toBe(2);
    expect(body.cupoMaximo).toBe(2);
    expect(await Inscripcion.countDocuments({ curso: curso._id })).toBe(2);
  });

  it('un cupo de cero, negativo o fraccionario es 400 al crear el curso', async () => {
    const { token } = await createUserAndLogin('admin');
    const profe = await createUserAndLogin('profesor');

    const crear = cupoMaximo =>
      request(app)
        .post('/api/cursos')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'X', profesor: profe.id, cupoMaximo });

    await crear(0).expect(400);
    await crear(2.5).expect(400);
    await crear(-1).expect(400);
  });

  it('el cupo se quita mandando null, y entonces vuelve a no haber límite', async () => {
    const admin = await createUserAndLogin('admin');
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Con tope', profesor: profe.id, cupoMaximo: 1 });

    await request(app)
      .put(`/api/cursos/${curso._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ cupoMaximo: null })
      .expect(200);

    // Borrado, no guardado a null: "sin cupo" tiene una sola forma.
    const guardado = await Curso.collection.findOne({ _id: curso._id });
    expect('cupoMaximo' in guardado).toBe(false);

    const uno = await createUserAndLogin('estudiante');
    const dos = await createUserAndLogin('estudiante');
    await matricular(uno.token, curso._id, uno.id).expect(201);
    await matricular(dos.token, curso._id, dos.id).expect(201);
  });
});

describe('Estado de un curso', () => {
  it('por defecto se crea abierto', async () => {
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Nuevo', profesor: profe.id });

    expect(curso.estado).toBe('abierto');
  });

  it('un curso cerrado no admite matrículas: 409 y sin crear nada', async () => {
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Cerrado', profesor: profe.id, estado: 'cerrado' });
    const alumno = await createUserAndLogin('estudiante');

    const { body } = await matricular(alumno.token, curso._id, alumno.id).expect(409);

    expect(body.msg).toMatch(/cerrado/i);
    expect(await Inscripcion.countDocuments({ curso: curso._id })).toBe(0);
  });

  it('un curso archivado tampoco, y lo dice de otra manera', async () => {
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({
      nombre: 'Archivado',
      profesor: profe.id,
      estado: 'archivado',
    });
    const alumno = await createUserAndLogin('estudiante');

    const { body } = await matricular(alumno.token, curso._id, alumno.id).expect(409);

    expect(body.msg).toMatch(/archivado/i);
  });

  it('un estado que no existe es 400', async () => {
    const admin = await createUserAndLogin('admin');
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'X', profesor: profe.id });

    await request(app)
      .put(`/api/cursos/${curso._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ estado: 'congelado' })
      .expect(400);
  });
});

describe('Los archivados desaparecen del catálogo, no de la base', () => {
  async function conUnArchivado() {
    const profe = await createUserAndLogin('profesor');
    const abierto = await Curso.create({ nombre: 'Se ve', profesor: profe.id });
    const archivado = await Curso.create({
      nombre: 'No se ve',
      profesor: profe.id,
      estado: 'archivado',
    });
    return { profe, abierto, archivado };
  }

  it('el estudiante no ve el archivado', async () => {
    const { archivado } = await conUnArchivado();
    const alumno = await createUserAndLogin('estudiante');

    const { body } = await catalogo(alumno.token).expect(200);

    const nombres = body.cursos.map(c => c.nombre);
    expect(nombres).toContain('Se ve');
    expect(nombres).not.toContain('No se ve');
    expect(JSON.stringify(body)).not.toContain(String(archivado._id));
  });

  it('administración sí lo ve, con su etiqueta', async () => {
    await conUnArchivado();
    const admin = await createUserAndLogin('admin');

    const { body } = await catalogo(admin.token).expect(200);

    const archivado = body.cursos.find(c => c.nombre === 'No se ve');
    expect(archivado).toBeDefined();
    expect(archivado.estado).toBe('archivado');
  });

  it('el profesor sigue viendo el suyo: archivar no es borrar', async () => {
    const { profe } = await conUnArchivado();

    const { body } = await request(app)
      .get('/api/cursos?profesor=me&limit=100')
      .set('Authorization', `Bearer ${profe.token}`)
      .expect(200);

    expect(body.cursos.map(c => c.nombre)).toContain('No se ve');
  });
});

describe('Migración de los cursos anteriores al campo `estado`', () => {
  it('los deja abiertos, y correrla otra vez no toca nada', async () => {
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Antiguo', profesor: profe.id });

    // Un curso "de antes": sin el campo escrito en la base. El default del
    // esquema no basta —Mongoose lo rellena al hidratar, pero una consulta que
    // filtre por `estado` mira la base, no el documento en memoria—.
    await Curso.collection.updateOne({ _id: curso._id }, { $unset: { estado: '' } });
    expect('estado' in (await Curso.collection.findOne({ _id: curso._id }))).toBe(false);

    expect(await migrarEstadoDeCursos()).toBe(1);
    expect((await Curso.collection.findOne({ _id: curso._id })).estado).toBe('abierto');

    // Idempotente.
    expect(await migrarEstadoDeCursos()).toBe(0);
  });

  it('mientras no se migre, un curso de antes tampoco desaparece del catálogo', async () => {
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Antiguo', profesor: profe.id });
    await Curso.collection.updateOne({ _id: curso._id }, { $unset: { estado: '' } });

    const alumno = await createUserAndLogin('estudiante');
    const { body } = await catalogo(alumno.token).expect(200);

    expect(body.cursos.map(c => c.nombre)).toContain('Antiguo');
  });
});
