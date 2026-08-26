// __tests__/seguridad.borrado.cascada.spec.js
// ---------------------------------------------------------------------------
// Los borrados no arrastraban nada y dejaban datos huérfanos:
//
//   - borrar un curso dejaba vivas sus inscripciones,
//   - borrar un estudiante dejaba vivas las suyas (el profesor seguía viendo
//     en clase a un alumno que ya no existe),
//   - borrar un profesor dejaba sus cursos apuntando a un id inexistente, y
//     `populate('profesor')` devolvía null: "Sin profesor asignado" para
//     siempre.
//
// No había ningún test que lo cubriera porque no había ningún código que lo
// hiciera. Cada caso comprueba el estado de la base después del borrado, no
// solo el código de respuesta.
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');
const Inscripcion = require('../models/Inscripcion');
const { createUserAndLogin, crearUsuario } = require('./helpers');

const borrarCurso = (id, token) =>
  request(app).delete(`/api/cursos/${id}`).set('Authorization', `Bearer ${token}`);

const borrarUsuario = (id, token) =>
  request(app).delete(`/api/usuarios/${id}`).set('Authorization', `Bearer ${token}`);

describe('DELETE /api/cursos/:id — arrastra sus inscripciones', () => {
  it('borrar un curso borra las matrículas de ese curso', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Condenado', profesor: profesor.id });

    const alumnoA = await crearUsuario({ rol: 'estudiante' });
    const alumnoB = await crearUsuario({ rol: 'estudiante' });
    await Inscripcion.create({ estudiante: alumnoA.id, curso: curso._id });
    await Inscripcion.create({ estudiante: alumnoB.id, curso: curso._id });

    const res = await borrarCurso(curso._id, admin.token).expect(200);

    expect(res.body.inscripcionesEliminadas).toBe(2);
    expect(await Inscripcion.countDocuments({ curso: curso._id })).toBe(0);
  });

  it('no toca las matrículas de otros cursos', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });
    const condenado = await Curso.create({ nombre: 'Condenado', profesor: profesor.id });
    const superviviente = await Curso.create({ nombre: 'Superviviente', profesor: profesor.id });

    const alumno = await crearUsuario({ rol: 'estudiante' });
    await Inscripcion.create({ estudiante: alumno.id, curso: condenado._id });
    await Inscripcion.create({ estudiante: alumno.id, curso: superviviente._id });

    await borrarCurso(condenado._id, admin.token).expect(200);

    expect(await Inscripcion.countDocuments()).toBe(1);
    expect(await Inscripcion.countDocuments({ curso: superviviente._id })).toBe(1);
  });

  it('un profesor que borra su propio curso también arrastra las matrículas', async () => {
    const profesor = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Mío', profesor: profesor.id });
    const alumno = await crearUsuario({ rol: 'estudiante' });
    await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    await borrarCurso(curso._id, profesor.token).expect(200);

    expect(await Inscripcion.countDocuments()).toBe(0);
  });

  it('un borrado rechazado por propiedad no borra ninguna matrícula', async () => {
    const { id: profesorId } = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Ajeno', profesor: profesorId });
    const alumno = await crearUsuario({ rol: 'estudiante' });
    await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    const intruso = await createUserAndLogin('profesor');
    await borrarCurso(curso._id, intruso.token).expect(403);

    expect(await Inscripcion.countDocuments()).toBe(1);
    expect(await Curso.findById(curso._id)).not.toBeNull();
  });
});

describe('DELETE /api/usuarios/:id — estudiante', () => {
  it('borrar un estudiante borra sus inscripciones', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Curso', profesor: profesor.id });

    const alumno = await crearUsuario({ rol: 'estudiante' });
    await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    const res = await borrarUsuario(alumno.id, admin.token).expect(200);

    expect(res.body.inscripcionesEliminadas).toBe(1);
    expect(await Inscripcion.countDocuments({ estudiante: alumno.id })).toBe(0);
    expect(await Usuario.findById(alumno.id)).toBeNull();
  });

  it('no toca las inscripciones de sus compañeros', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Curso', profesor: profesor.id });

    const seVa = await crearUsuario({ rol: 'estudiante' });
    const seQueda = await crearUsuario({ rol: 'estudiante' });
    await Inscripcion.create({ estudiante: seVa.id, curso: curso._id });
    await Inscripcion.create({ estudiante: seQueda.id, curso: curso._id });

    await borrarUsuario(seVa.id, admin.token).expect(200);

    expect(await Inscripcion.countDocuments()).toBe(1);
    expect(await Inscripcion.countDocuments({ estudiante: seQueda.id })).toBe(1);
  });
});

describe('DELETE /api/usuarios/:id — profesor con cursos', () => {
  it('se rechaza con 409, el profesor sigue vivo y sus cursos también', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });
    await Curso.create({ nombre: 'Uno', profesor: profesor.id });
    await Curso.create({ nombre: 'Dos', profesor: profesor.id });

    const res = await borrarUsuario(profesor.id, admin.token);

    expect(res.status).toBe(409);
    // El mensaje dice cuántos, que es lo que hace falta para arreglarlo.
    expect(res.body.cursos).toBe(2);
    expect(res.body.msg).toContain('2');

    expect(await Usuario.findById(profesor.id)).not.toBeNull();
    expect(await Curso.countDocuments({ profesor: profesor.id })).toBe(2);
  });

  it('tras reasignar sus cursos, el borrado sí procede', async () => {
    const admin = await createUserAndLogin('admin');
    const seVa = await crearUsuario({ rol: 'profesor' });
    const releva = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Traspasado', profesor: seVa.id });

    await borrarUsuario(seVa.id, admin.token).expect(409);

    await request(app)
      .put(`/api/cursos/${curso._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ profesor: releva.id })
      .expect(200);

    await borrarUsuario(seVa.id, admin.token).expect(200);

    expect(await Usuario.findById(seVa.id)).toBeNull();
    // Y el curso sigue en pie, ahora con otro profesor.
    expect(String((await Curso.findById(curso._id)).profesor)).toBe(releva.id);
  });

  it('un profesor sin cursos se borra sin más', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });

    await borrarUsuario(profesor.id, admin.token).expect(200);

    expect(await Usuario.findById(profesor.id)).toBeNull();
  });

  it('ningún curso queda apuntando a un profesor que ya no existe', async () => {
    const admin = await createUserAndLogin('admin');
    const profesor = await crearUsuario({ rol: 'profesor' });
    await Curso.create({ nombre: 'Con dueño', profesor: profesor.id });

    await borrarUsuario(profesor.id, admin.token);

    // Invariante del sistema, con independencia de cómo se haya resuelto la
    // petición: todo curso tiene un profesor que existe.
    const cursos = await Curso.find();
    for (const curso of cursos) {
      expect(await Usuario.findById(curso.profesor)).not.toBeNull();
    }
  });
});
