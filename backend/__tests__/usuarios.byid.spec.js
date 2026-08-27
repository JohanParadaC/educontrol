// __tests__/usuarios.byid.spec.js
// ---------------------------------------------------------------------------
// GET /api/usuarios/:id — uno mismo o un admin, y nadie más.
//
// La ficha devuelve nombre, correo, rol y fechas, y estaba abierta a cualquiera
// con sesión. Aquí se fija la regla estrecha: el caso del profesor sobre su
// propio alumno se comprueba a propósito, para que ampliar el permiso sea una
// decisión y no una costumbre.
// ---------------------------------------------------------------------------
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const { createUserAndLogin, crearUsuario } = require('./helpers');

const pedirFicha = (id, token) =>
  request(app).get(`/api/usuarios/${id}`).set('Authorization', `Bearer ${token}`);

describe('Usuarios byId', () => {
  it('uno mismo se lee la suya: 200', async () => {
    const { id, token, correo } = await createUserAndLogin('estudiante');

    const res = await pedirFicha(id, token);

    expect(res.status).toBe(200);
    expect(res.body.usuario.correo).toBe(correo);
    expect(res.body.usuario.contraseña).toBeUndefined();
  });

  it('un admin lee la de cualquiera: 200', async () => {
    const { token } = await createUserAndLogin('admin');
    const { id, correo } = await crearUsuario({ rol: 'estudiante' });

    const res = await pedirFicha(id, token);

    expect(res.status).toBe(200);
    expect(res.body.usuario.correo).toBe(correo);
  });

  it('un estudiante NO lee la de otro estudiante: 404', async () => {
    const { token } = await createUserAndLogin('estudiante');
    const { id, correo } = await crearUsuario({ rol: 'estudiante' });

    const res = await pedirFicha(id, token);

    expect(res.status).toBe(404);
    expect(res.body.usuario).toBeUndefined();
    // Ni el correo ni nada suyo se cuela en el cuerpo del error.
    expect(JSON.stringify(res.body)).not.toContain(correo);
  });

  it('un profesor NO lee la de un alumno suyo: 404 (regla estrecha, a propósito)', async () => {
    const profesor = await createUserAndLogin('profesor');
    const alumno = await crearUsuario({ rol: 'estudiante' });

    const curso = await Curso.create({ nombre: 'Álgebra', profesor: profesor.id });
    await Inscripcion.create({ curso: curso._id, estudiante: alumno.id });

    const res = await pedirFicha(alumno.id, profesor.token);

    // Su ficha del curso ya le da el nombre y el correo de los matriculados;
    // esta ruta no se abre para eso. Si algún día hace falta, este test es el
    // que avisa de que se está ampliando el permiso.
    expect(res.status).toBe(404);
  });

  it('un tercero y un id inexistente responden exactamente lo mismo', async () => {
    const { token } = await createUserAndLogin('estudiante');
    const { id } = await crearUsuario({ rol: 'profesor' });
    const inventado = new mongoose.Types.ObjectId().toString();

    const ajena = await pedirFicha(id, token);
    const fantasma = await pedirFicha(inventado, token);

    expect(ajena.status).toBe(fantasma.status);
    expect(ajena.body).toEqual(fantasma.body);
  });

  it('sin sesión no se lee ni la propia: 401', async () => {
    const { id } = await crearUsuario({ rol: 'estudiante' });
    await request(app).get(`/api/usuarios/${id}`).expect(401);
  });

  it('un id mal formado sigue siendo 400', async () => {
    const { token } = await createUserAndLogin('admin');
    const res = await pedirFicha('xxx', token);
    expect(res.status).toBe(400);
  });

  it('PUT /api/usuarios/:id con id inválido → 400', async () => {
    const { token } = await createUserAndLogin('admin');
    const res = await request(app)
      .put('/api/usuarios/xxx')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Nuevo' });
    expect(res.status).toBe(400);
  });
});
