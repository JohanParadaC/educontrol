// __tests__/contrato.filtros.spec.js
// ---------------------------------------------------------------------------
// Filtros que antes vivían en el navegador y ahora los hace el servidor.
//
// "Mis clases" se descargaba hasta 100 cursos y comparaba identificadores en
// el cliente, con un respaldo que comparaba nombres normalizados sin tildes
// "por si los datos son antiguos". La búsqueda del catálogo filtraba sobre
// esos mismos 100. Con 101 cursos, las dos mienten sin decirlo.
//
// Y la baja de una matrícula: la ruta era solo de admin, así que un estudiante
// podía entrar en un curso pero no salir.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const { createUserAndLogin, crearUsuario } = require('./helpers');

const listarCursos = (token, query = '') =>
  request(app).get(`/api/cursos${query}`).set('Authorization', `Bearer ${token}`);

describe('GET /api/cursos?profesor=', () => {
  it('"me" devuelve solo los cursos de quien pregunta', async () => {
    const ana = await createUserAndLogin('profesor', { nombre: 'Ana' });
    const bruno = await crearUsuario({ rol: 'profesor', nombre: 'Bruno' });

    await Curso.create({ nombre: 'Uno de Ana', profesor: ana.id });
    await Curso.create({ nombre: 'Dos de Ana', profesor: ana.id });
    await Curso.create({ nombre: 'De Bruno', profesor: bruno.id });

    const { body } = await listarCursos(ana.token, '?profesor=me').expect(200);

    expect(body.cursos).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.cursos.every(c => String(c.profesor.id) === ana.id)).toBe(true);
  });

  it('acepta también un identificador concreto', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });
    const otro = await crearUsuario({ rol: 'profesor' });
    await Curso.create({ nombre: 'Suyo', profesor: profesor.id });
    await Curso.create({ nombre: 'Del otro', profesor: otro.id });

    const { body } = await listarCursos(admin.token, `?profesor=${profesor.id}`).expect(200);

    expect(body.cursos).toHaveLength(1);
    expect(body.cursos[0].nombre).toBe('Suyo');
  });

  it('un profesor sin cursos recibe una lista vacía, no el catálogo entero', async () => {
    const otro = await crearUsuario({ rol: 'profesor' });
    await Curso.create({ nombre: 'De otro', profesor: otro.id });
    const nuevo = await createUserAndLogin('profesor');

    const { body } = await listarCursos(nuevo.token, '?profesor=me').expect(200);

    expect(body.cursos).toEqual([]);
  });

  it('un valor que no es "me" ni un id es un 400, no un 500', async () => {
    const { token } = await createUserAndLogin('profesor');

    const res = await listarCursos(token, '?profesor=cualquier-cosa');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/cursos?buscar=', () => {
  /** Tres cursos con textos separados, para saber cuál engancha cada búsqueda. */
  async function catalogo() {
    const profesor = await crearUsuario({ rol: 'profesor' });
    await Curso.create({
      nombre: 'Angular desde cero',
      descripcion: 'Componentes y formularios',
      profesor: profesor.id,
    });
    await Curso.create({
      nombre: 'Node.js y APIs REST',
      descripcion: 'Express y autenticación',
      profesor: profesor.id,
    });
    await Curso.create({
      nombre: 'Bases de datos',
      descripcion: 'Modelado con Angular de por medio',
      profesor: profesor.id,
    });
    return profesor;
  }

  it('busca en el nombre', async () => {
    await catalogo();
    const { token } = await createUserAndLogin('estudiante');

    const { body } = await listarCursos(token, '?buscar=Node').expect(200);

    expect(body.cursos).toHaveLength(1);
    expect(body.cursos[0].nombre).toBe('Node.js y APIs REST');
  });

  it('busca también en la descripción', async () => {
    await catalogo();
    const { token } = await createUserAndLogin('estudiante');

    const { body } = await listarCursos(token, '?buscar=Angular').expect(200);

    // Uno por el nombre y otro por la descripción.
    expect(body.cursos).toHaveLength(2);
  });

  it('no distingue mayúsculas', async () => {
    await catalogo();
    const { token } = await createUserAndLogin('estudiante');

    const { body } = await listarCursos(token, '?buscar=nODE').expect(200);

    expect(body.cursos).toHaveLength(1);
  });

  it('el total refleja el filtro, no el catálogo entero', async () => {
    await catalogo();
    const { token } = await createUserAndLogin('estudiante');

    const { body } = await listarCursos(token, '?buscar=Node').expect(200);

    expect(body.total).toBe(1);
  });

  it('los caracteres de expresión regular se tratan como texto', async () => {
    const profesor = await crearUsuario({ rol: 'profesor' });
    await Curso.create({ nombre: 'C++ para principiantes', profesor: profesor.id });
    await Curso.create({ nombre: 'Python', profesor: profesor.id });
    const { token } = await createUserAndLogin('estudiante');

    // Sin escapar, '+' es un cuantificador: la regex sería inválida y saldría
    // un 500, o peor, engancharía cosas que nadie ha pedido.
    const { body } = await listarCursos(token, '?buscar=C%2B%2B').expect(200);

    expect(body.cursos).toHaveLength(1);
    expect(body.cursos[0].nombre).toBe('C++ para principiantes');
  });

  it('una búsqueda desmesurada se rechaza con 400', async () => {
    const { token } = await createUserAndLogin('estudiante');

    const res = await listarCursos(token, `?buscar=${'a'.repeat(101)}`);

    expect(res.status).toBe(400);
  });

  it('los dos filtros se combinan', async () => {
    const ana = await createUserAndLogin('profesor');
    const bruno = await crearUsuario({ rol: 'profesor' });
    await Curso.create({ nombre: 'Angular de Ana', profesor: ana.id });
    await Curso.create({ nombre: 'Angular de Bruno', profesor: bruno.id });

    const { body } = await listarCursos(ana.token, '?profesor=me&buscar=Angular').expect(200);

    expect(body.cursos).toHaveLength(1);
    expect(body.cursos[0].nombre).toBe('Angular de Ana');
  });
});

describe('DELETE /api/inscripciones/:id — darse de baja', () => {
  /** Un alumno matriculado en un curso cualquiera. */
  async function matriculado() {
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Curso', profesor: profesor.id });
    const alumno = await createUserAndLogin('estudiante');
    const inscripcion = await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });
    return { alumno, curso, inscripcion, profesor };
  }

  const borrar = (id, token) =>
    request(app).delete(`/api/inscripciones/${id}`).set('Authorization', `Bearer ${token}`);

  it('un estudiante se da de baja de la suya → 200 y desaparece', async () => {
    const { alumno, inscripcion } = await matriculado();

    await borrar(inscripcion._id, alumno.token).expect(200);

    expect(await Inscripcion.findById(inscripcion._id)).toBeNull();
  });

  it('no puede dar de baja la de otro → 403 y sigue ahí', async () => {
    const { inscripcion } = await matriculado();
    const intruso = await createUserAndLogin('estudiante');

    const res = await borrar(inscripcion._id, intruso.token);

    expect(res.status).toBe(403);
    expect(await Inscripcion.findById(inscripcion._id)).not.toBeNull();
  });

  it('un admin puede con cualquiera → 200', async () => {
    const { inscripcion } = await matriculado();
    const admin = await createUserAndLogin('admin');

    await borrar(inscripcion._id, admin.token).expect(200);

    expect(await Inscripcion.countDocuments()).toBe(0);
  });

  it('el profesor del curso todavía no puede: dar de baja a un alumno es otra cosa', async () => {
    const { curso, inscripcion } = await matriculado();
    const profesor = await createUserAndLogin('profesor');
    await Curso.findByIdAndUpdate(curso._id, { profesor: profesor.id });

    const res = await borrar(inscripcion._id, profesor.token);

    expect(res.status).toBe(403);
    expect(await Inscripcion.findById(inscripcion._id)).not.toBeNull();
  });

  it('sin token no se borra nada', async () => {
    const { inscripcion } = await matriculado();

    await request(app).delete(`/api/inscripciones/${inscripcion._id}`).expect(401);

    expect(await Inscripcion.countDocuments()).toBe(1);
  });

  it('una matrícula que no existe da 404', async () => {
    const { alumno } = await matriculado();
    const inexistente = '66a7c1b2a1a1a1a1a1a1a1a1';

    await borrar(inexistente, alumno.token).expect(404);
  });

  it('darse de baja no toca las matrículas de los demás', async () => {
    const { alumno, curso, inscripcion } = await matriculado();
    const compañero = await crearUsuario({ rol: 'estudiante' });
    await Inscripcion.create({ estudiante: compañero.id, curso: curso._id });

    await borrar(inscripcion._id, alumno.token).expect(200);

    expect(await Inscripcion.countDocuments()).toBe(1);
    expect(await Inscripcion.countDocuments({ estudiante: compañero.id })).toBe(1);
  });
});

describe('GET /api/inscripciones — el curso llega con su profesor', () => {
  it('populate anidado: la pantalla "Mis cursos" necesita saber quién imparte', async () => {
    const profesor = await crearUsuario({ rol: 'profesor', nombre: 'Lucía Fernández' });
    const curso = await Curso.create({
      nombre: 'Angular desde cero',
      descripcion: 'Componentes',
      profesor: profesor.id,
    });
    const alumno = await createUserAndLogin('estudiante');
    await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    const { body } = await request(app)
      .get('/api/inscripciones')
      .set('Authorization', `Bearer ${alumno.token}`)
      .expect(200);

    expect(body.inscripciones[0].curso.nombre).toBe('Angular desde cero');
    expect(body.inscripciones[0].curso.profesor.nombre).toBe('Lucía Fernández');
    // Y sigue sin salir nada que no deba: el profesor va con nombre y correo.
    expect(body.inscripciones[0].curso.profesor).not.toHaveProperty('contraseña');
  });
});
