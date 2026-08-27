// __tests__/auditoria.spec.js
// ---------------------------------------------------------------------------
// El registro de acciones administrativas.
//
// Los datos de la aplicación cuentan el estado actual y nada más: si un curso
// desaparece o alguien pasa a profesor, el "quién y cuándo" o se guarda en el
// momento o se pierde para siempre.
//
// Dos cosas que este fichero fija además del registro en sí:
//
//  - Que auditar NUNCA cambie el resultado de la operación. El registro se
//    escribe sin esperar; si fallara, la acción ya ocurrió.
//  - Que matricularse o darse de baja UNO MISMO no se registre. Es uso normal
//    de la aplicación; meterlo llenaría el historial y taparía lo que importa.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Curso = require('../models/Curso');
const Auditoria = require('../models/Auditoria');
const { createUserAndLogin } = require('./helpers');

/** El registro se escribe sin await: se espera a que aparezca. */
async function esperarRegistros(cuantos, intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    const filas = await Auditoria.find().sort({ createdAt: 1 }).lean();
    if (filas.length >= cuantos) return filas;
    await new Promise(r => setTimeout(r, 25));
  }
  return Auditoria.find().sort({ createdAt: 1 }).lean();
}

const auth = token => ({ Authorization: `Bearer ${token}` });

describe('Qué queda registrado', () => {
  it('un cambio de rol, con el valor de antes y el de después', async () => {
    const admin = await createUserAndLogin('admin', { nombre: 'Jefa' });
    const alumno = await createUserAndLogin('estudiante', { nombre: 'Nuria' });

    await request(app)
      .put(`/api/usuarios/${alumno.id}`)
      .set(auth(admin.token))
      .send({ rol: 'profesor' })
      .expect(200);

    const [fila] = await esperarRegistros(1);

    expect(fila.accion).toBe('rol.cambiado');
    expect(fila.actorNombre).toBe('Jefa');
    expect(fila.actorRol).toBe('admin');
    expect(fila.recurso).toMatchObject({ tipo: 'usuario', etiqueta: 'Nuria' });
    expect(fila.antes).toEqual({ rol: 'estudiante' });
    expect(fila.despues).toEqual({ rol: 'profesor' });
  });

  it('un rol que no cambia nada no se registra', async () => {
    const admin = await createUserAndLogin('admin');
    const alumno = await createUserAndLogin('estudiante');

    await request(app)
      .put(`/api/usuarios/${alumno.id}`)
      .set(auth(admin.token))
      .send({ rol: 'estudiante' })
      .expect(200);

    await new Promise(r => setTimeout(r, 200));
    expect(await Auditoria.countDocuments()).toBe(0);
  });

  it('cambiarse el nombre no se registra: no es una acción administrativa', async () => {
    const alumno = await createUserAndLogin('estudiante');

    await request(app)
      .put(`/api/usuarios/${alumno.id}`)
      .set(auth(alumno.token))
      .send({ nombre: 'Otro nombre' })
      .expect(200);

    await new Promise(r => setTimeout(r, 200));
    expect(await Auditoria.countDocuments()).toBe(0);
  });

  it('crear, editar y borrar un curso: tres entradas encadenadas', async () => {
    const admin = await createUserAndLogin('admin');
    const profe = await createUserAndLogin('profesor');

    const { body } = await request(app)
      .post('/api/cursos')
      .set(auth(admin.token))
      .send({ nombre: 'Álgebra', descripcion: 'Vectores', profesor: profe.id })
      .expect(201);
    const id = body.curso._id;

    await request(app)
      .put(`/api/cursos/${id}`)
      .set(auth(admin.token))
      .send({ nombre: 'Álgebra II', cupoMaximo: 30 })
      .expect(200);

    await request(app).delete(`/api/cursos/${id}`).set(auth(admin.token)).expect(200);

    const filas = await esperarRegistros(3);

    expect(filas.map(f => f.accion)).toEqual(['curso.creado', 'curso.editado', 'curso.borrado']);
    expect(filas[1].antes).toMatchObject({ nombre: 'Álgebra', cupoMaximo: null });
    expect(filas[1].despues).toMatchObject({ nombre: 'Álgebra II', cupoMaximo: 30 });
    // La etiqueta se guarda para que el borrado siga leyéndose cuando el curso
    // ya no está.
    expect(filas[2].recurso.etiqueta).toBe('Álgebra II');
  });
});

describe('Matrículas: solo las que hace un tercero', () => {
  it('matricularse uno mismo no deja rastro', async () => {
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Abierto', profesor: profe.id });
    const alumno = await createUserAndLogin('estudiante');

    await request(app)
      .post('/api/inscripciones')
      .set(auth(alumno.token))
      .send({ cursoId: String(curso._id), estudianteId: alumno.id })
      .expect(201);

    await new Promise(r => setTimeout(r, 200));
    expect(await Auditoria.countDocuments()).toBe(0);
  });

  it('darse de baja uno mismo, tampoco', async () => {
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Abierto', profesor: profe.id });
    const alumno = await createUserAndLogin('estudiante');

    const { body } = await request(app)
      .post('/api/inscripciones')
      .set(auth(alumno.token))
      .send({ cursoId: String(curso._id), estudianteId: alumno.id })
      .expect(201);

    await request(app)
      .delete(`/api/inscripciones/${body.inscripcion._id}`)
      .set(auth(alumno.token))
      .expect(200);

    await new Promise(r => setTimeout(r, 200));
    expect(await Auditoria.countDocuments()).toBe(0);
  });

  it('que te matricule el profesor sí, con quién y en qué', async () => {
    const profe = await createUserAndLogin('profesor', { nombre: 'Ana' });
    const curso = await Curso.create({ nombre: 'Álgebra', profesor: profe.id });
    const alumno = await createUserAndLogin('estudiante', { nombre: 'Nuria' });

    await request(app)
      .post('/api/inscripciones')
      .set(auth(profe.token))
      .send({ cursoId: String(curso._id), correo: alumno.correo })
      .expect(201);

    const [fila] = await esperarRegistros(1);

    expect(fila.accion).toBe('matricula.creada');
    expect(fila.actorNombre).toBe('Ana');
    expect(fila.recurso.etiqueta).toContain('Nuria');
    expect(fila.recurso.etiqueta).toContain('Álgebra');
  });

  it('que te dé de baja un admin, también', async () => {
    const admin = await createUserAndLogin('admin');
    const profe = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Álgebra', profesor: profe.id });
    const alumno = await createUserAndLogin('estudiante', { nombre: 'Nuria' });

    const { body } = await request(app)
      .post('/api/inscripciones')
      .set(auth(alumno.token))
      .send({ cursoId: String(curso._id), estudianteId: alumno.id })
      .expect(201);

    await request(app)
      .delete(`/api/inscripciones/${body.inscripcion._id}`)
      .set(auth(admin.token))
      .expect(200);

    const [fila] = await esperarRegistros(1);

    expect(fila.accion).toBe('matricula.borrada');
    expect(fila.recurso.etiqueta).toContain('Nuria');
    expect(fila.antes.curso).toBe('Álgebra');
  });
});

describe('GET /api/auditoria', () => {
  /** Tres entradas de acciones distintas, para poder filtrar. */
  async function historial() {
    const admin = await createUserAndLogin('admin', { nombre: 'Jefa' });
    const profe = await createUserAndLogin('profesor', { nombre: 'Ana' });
    const alumno = await createUserAndLogin('estudiante', { nombre: 'Nuria' });

    await request(app)
      .post('/api/cursos')
      .set(auth(admin.token))
      .send({ nombre: 'Álgebra', profesor: profe.id })
      .expect(201);

    await request(app)
      .put(`/api/usuarios/${alumno.id}`)
      .set(auth(admin.token))
      .send({ rol: 'profesor' })
      .expect(200);

    await esperarRegistros(2);
    return { admin, profe, alumno };
  }

  it('solo para administración', async () => {
    const { profe, alumno } = await historial();

    await request(app).get('/api/auditoria').set(auth(profe.token)).expect(403);
    await request(app).get('/api/auditoria').set(auth(alumno.token)).expect(403);
    await request(app).get('/api/auditoria').expect(401);
  });

  it('lo más reciente primero, y paginado como el resto', async () => {
    const { admin } = await historial();

    const { body } = await request(app).get('/api/auditoria').set(auth(admin.token)).expect(200);

    expect(body.registros).toHaveLength(2);
    expect(body.registros[0].accion).toBe('rol.cambiado'); // el último en ocurrir
    expect(body.total).toBe(2);
    expect(body.paginas).toBe(1);
  });

  it('el tope de página sigue siendo 100 aunque se pida más', async () => {
    const { admin } = await historial();

    const { body } = await request(app)
      .get('/api/auditoria?limit=999999')
      .set(auth(admin.token))
      .expect(200);

    expect(body.limite).toBe(100);
  });

  it('filtra por acción', async () => {
    const { admin } = await historial();

    const { body } = await request(app)
      .get('/api/auditoria?accion=curso.creado')
      .set(auth(admin.token))
      .expect(200);

    expect(body.registros).toHaveLength(1);
    expect(body.registros[0].recurso.etiqueta).toBe('Álgebra');
  });

  it('una acción que no existe es 400, no una lista vacía que parece un "no pasó nada"', async () => {
    const { admin } = await historial();

    await request(app).get('/api/auditoria?accion=inventada').set(auth(admin.token)).expect(400);
  });

  it('busca por quién lo hizo y por sobre qué', async () => {
    const { admin } = await historial();

    const porActor = await request(app)
      .get('/api/auditoria?buscar=jefa')
      .set(auth(admin.token))
      .expect(200);
    expect(porActor.body.registros).toHaveLength(2);

    const porRecurso = await request(app)
      .get('/api/auditoria?buscar=Álgebra')
      .set(auth(admin.token))
      .expect(200);
    expect(porRecurso.body.registros).toHaveLength(1);
  });

  it('el texto de búsqueda es literal, no un patrón', async () => {
    const { admin } = await historial();

    const { body } = await request(app)
      .get('/api/auditoria?buscar=.*')
      .set(auth(admin.token))
      .expect(200);

    expect(body.registros).toHaveLength(0);
  });

  it('el historial no se puede escribir ni borrar desde fuera', async () => {
    const { admin } = await historial();

    await request(app).post('/api/auditoria').set(auth(admin.token)).send({}).expect(404);
    await request(app).delete('/api/auditoria').set(auth(admin.token)).expect(404);
  });
});
