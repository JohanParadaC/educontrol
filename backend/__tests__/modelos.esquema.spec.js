// __tests__/modelos.esquema.spec.js
// ---------------------------------------------------------------------------
// Lo que los esquemas garantizan, y que hasta ahora no garantizaban:
//
//   - Nadie sabía cuándo se creó un curso ni cuándo se modificó una cuenta.
//   - `Ana@x.com` y `ana@x.com` eran dos cuentas distintas pese al índice
//     único: para Mongo son valores diferentes.
//   - `Curso.descripcion` no tenía tope, y el panel de administración llevaba
//     un DESC_LARGA = 200 para "compactar acciones" cuando se desbordaba: un
//     parche visual a un dato que nadie había acotado.
//   - Se podía matricular a un administrador en un curso inexistente.
// ---------------------------------------------------------------------------
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');
const Inscripcion = require('../models/Inscripcion');
const { createUserAndLogin, crearUsuario, uniqueEmail } = require('./helpers');

const idInexistente = () => new mongoose.Types.ObjectId().toString();

describe('timestamps', () => {
  it('un usuario guarda cuándo se creó y cuándo se tocó', async () => {
    const { usuario } = await crearUsuario({ rol: 'estudiante' });

    expect(usuario.createdAt).toBeInstanceOf(Date);
    expect(usuario.updatedAt).toBeInstanceOf(Date);
  });

  it('modificar un usuario mueve updatedAt', async () => {
    const { usuario } = await crearUsuario({ rol: 'estudiante' });
    const antes = usuario.updatedAt.getTime();

    await new Promise(r => setTimeout(r, 10));
    usuario.nombre = 'Otro nombre';
    await usuario.save();

    expect(usuario.updatedAt.getTime()).toBeGreaterThan(antes);
  });

  it('un curso también', async () => {
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Curso', profesor: profesor.id });

    expect(curso.createdAt).toBeInstanceOf(Date);
  });

  it('una inscripción conserva `fecha` y añade createdAt', async () => {
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Curso', profesor: profesor.id });
    const alumno = await crearUsuario({ rol: 'estudiante' });

    const inscripcion = await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    // `fecha` sigue ahí por compatibilidad; createdAt dice lo mismo.
    expect(inscripcion.fecha).toBeInstanceOf(Date);
    expect(inscripcion.createdAt).toBeInstanceOf(Date);
  });
});

describe('Usuario.correo — mayúsculas y espacios', () => {
  it('se guarda en minúsculas y sin espacios', async () => {
    const usuario = await Usuario.create({
      nombre: 'Ana',
      correo: '  ANA.Torres@Mail.com  ',
      contraseña: 'hash-de-mentira',
      rol: 'estudiante',
    });

    expect(usuario.correo).toBe('ana.torres@mail.com');
  });

  it('dos correos que solo difieren en mayúsculas colisionan', async () => {
    const correo = uniqueEmail('choque');

    await Usuario.create({ nombre: 'Uno', correo, contraseña: 'x'.repeat(8), rol: 'estudiante' });

    // Sin lowercase esto pasaba y quedaban dos cuentas para la misma persona.
    await expect(
      Usuario.create({
        nombre: 'Dos',
        correo: correo.toUpperCase(),
        contraseña: 'x'.repeat(8),
        rol: 'estudiante',
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('el registro por la API rechaza el mismo correo en mayúsculas', async () => {
    const correo = uniqueEmail('registro');
    const cuerpo = { nombre: 'Ana', contraseña: 'Secret123', rol: 'estudiante' };

    await request(app)
      .post('/api/usuarios')
      .send({ ...cuerpo, correo })
      .expect(201);

    const res = await request(app)
      .post('/api/usuarios')
      .send({ ...cuerpo, correo: correo.toUpperCase() });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await Usuario.countDocuments({ correo })).toBe(1);
  });

  it('se puede entrar escribiendo el correo en mayúsculas', async () => {
    const { correo, password } = await crearUsuario({ rol: 'estudiante' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo: correo.toUpperCase(), contraseña: password });

    expect(res.status).toBe(200);
  });
});

describe('Curso — restricciones de longitud', () => {
  it('el nombre no pasa de 120 caracteres', async () => {
    const profesor = await crearUsuario({ rol: 'profesor' });

    await expect(
      Curso.create({ nombre: 'a'.repeat(121), profesor: profesor.id })
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('la descripción no pasa de 500', async () => {
    const profesor = await crearUsuario({ rol: 'profesor' });

    await expect(
      Curso.create({ nombre: 'Curso', descripcion: 'a'.repeat(501), profesor: profesor.id })
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });

  it('por la API, una descripción desmesurada es un 400 con el campo, no un 500', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });

    const res = await request(app)
      .post('/api/cursos')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ nombre: 'Curso', descripcion: 'a'.repeat(501), profesor: profesor.id });

    expect(res.status).toBe(400);
    expect(res.body.campos).toContain('descripcion');
  });

  it('recorta los espacios de los extremos', async () => {
    const profesor = await crearUsuario({ rol: 'profesor' });

    const curso = await Curso.create({
      nombre: '  Angular desde cero  ',
      descripcion: '  Componentes  ',
      profesor: profesor.id,
    });

    expect(curso.nombre).toBe('Angular desde cero');
    expect(curso.descripcion).toBe('Componentes');
  });
});

describe('Índices', () => {
  it('Usuario tiene índice por rol y Curso por profesor', async () => {
    const porUsuario = await Usuario.collection.indexes();
    const porCurso = await Curso.collection.indexes();

    expect(porUsuario.some(i => i.key.rol === 1)).toBe(true);
    expect(porCurso.some(i => i.key.profesor === 1)).toBe(true);
  });
});

describe('POST /api/inscripciones — el contenido también se valida', () => {
  const inscribir = (token, body) =>
    request(app).post('/api/inscripciones').set('Authorization', `Bearer ${token}`).send(body);

  it('un curso que no existe → 404 y no se crea nada', async () => {
    const alumno = await createUserAndLogin('estudiante');

    const res = await inscribir(alumno.token, {
      cursoId: idInexistente(),
      estudianteId: alumno.id,
    });

    expect(res.status).toBe(404);
    expect(await Inscripcion.countDocuments()).toBe(0);
  });

  it('un estudiante que no existe → 404', async () => {
    const alumno = await createUserAndLogin('estudiante');
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Curso', profesor: profesor.id });

    const res = await inscribir(alumno.token, {
      cursoId: curso._id,
      estudianteId: idInexistente(),
    });

    expect(res.status).toBe(404);
    expect(await Inscripcion.countDocuments()).toBe(0);
  });

  it('no se puede matricular a un administrador → 400', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Curso', profesor: profesor.id });

    const res = await inscribir(admin.token, { cursoId: curso._id, estudianteId: admin.id });

    expect(res.status).toBe(400);
    expect(await Inscripcion.countDocuments()).toBe(0);
  });

  it('tampoco a un profesor → 400', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Curso', profesor: profesor.id });

    const res = await inscribir(admin.token, { cursoId: curso._id, estudianteId: profesor.id });

    expect(res.status).toBe(400);
  });

  it('dos matrículas iguales a la vez: una entra y la otra es 400, no un 500', async () => {
    const alumno = await createUserAndLogin('estudiante');
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Curso', profesor: profesor.id });
    const cuerpo = { cursoId: String(curso._id), estudianteId: alumno.id };

    // En paralelo, que es donde el findOne-previo se quedaba corto: las dos
    // leían "no está", las dos insertaban y la segunda salía como 500.
    const [a, b] = await Promise.all([
      inscribir(alumno.token, cuerpo),
      inscribir(alumno.token, cuerpo),
    ]);

    const codigos = [a.status, b.status].sort();
    expect(codigos).toEqual([201, 400]);
    expect(await Inscripcion.countDocuments()).toBe(1);
  });
});
