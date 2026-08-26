// __tests__/seguridad.cursos.propiedad.spec.js
// ---------------------------------------------------------------------------
// PUT y DELETE /api/cursos/:id estaban protegidos con roleCheck('profesor',
// 'admin'), que comprueba el ROL pero no la PROPIEDAD. Cualquier profesor
// editaba o borraba el curso de otro profesor.
//
// Es el mismo fallo que ya se corrigió en usuarios.controller.js y que no se
// replicó aquí. Cada test comprueba el efecto: tras el 403, el curso sigue
// llamándose igual y sigue existiendo.
// ---------------------------------------------------------------------------
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Curso = require('../models/Curso');
const { createUserAndLogin } = require('./helpers');

const idInexistente = () => new mongoose.Types.ObjectId().toString();

const put = (id, token, body) =>
  request(app).put(`/api/cursos/${id}`).set('Authorization', `Bearer ${token}`).send(body);

const del = (id, token) =>
  request(app).delete(`/api/cursos/${id}`).set('Authorization', `Bearer ${token}`);

/** Un profesor con un curso suyo. */
async function profesorConCurso(nombre = 'Curso original') {
  const profesor = await createUserAndLogin('profesor');
  const curso = await Curso.create({ nombre, descripcion: 'demo', profesor: profesor.id });
  return { profesor, curso };
}

describe('PUT /api/cursos/:id — propiedad', () => {
  it('un profesor no puede renombrar el curso de otro → 403 y el nombre no cambia', async () => {
    const { curso } = await profesorConCurso('Álgebra I');
    const intruso = await createUserAndLogin('profesor');

    const res = await put(curso._id, intruso.token, { nombre: 'Secuestrado' });

    expect(res.status).toBe(403);
    expect((await Curso.findById(curso._id)).nombre).toBe('Álgebra I');
  });

  it('un profesor no puede robarse el curso de otro reasignándose el profesor → 403', async () => {
    const { profesor, curso } = await profesorConCurso();
    const intruso = await createUserAndLogin('profesor');

    const res = await put(curso._id, intruso.token, { profesor: intruso.id });

    expect(res.status).toBe(403);
    expect(String((await Curso.findById(curso._id)).profesor)).toBe(profesor.id);
  });

  it('un profesor sí puede editar el suyo → 200 y el cambio se aplica', async () => {
    const { profesor, curso } = await profesorConCurso();

    const res = await put(curso._id, profesor.token, { nombre: 'Nombre nuevo' });

    expect(res.status).toBe(200);
    expect((await Curso.findById(curso._id)).nombre).toBe('Nombre nuevo');
  });

  it('un admin puede editar el curso de cualquiera → 200', async () => {
    const { curso } = await profesorConCurso();
    const admin = await createUserAndLogin('admin');

    const res = await put(curso._id, admin.token, { nombre: 'Renombrado por admin' });

    expect(res.status).toBe(200);
    expect((await Curso.findById(curso._id)).nombre).toBe('Renombrado por admin');
  });

  it('un estudiante no llega ni al controlador → 403', async () => {
    const { curso } = await profesorConCurso('Intacto');
    const alumno = await createUserAndLogin('estudiante');

    const res = await put(curso._id, alumno.token, { nombre: 'Hackeado' });

    expect(res.status).toBe(403);
    expect((await Curso.findById(curso._id)).nombre).toBe('Intacto');
  });

  it('un curso inexistente da 404, no 403', async () => {
    const profesor = await createUserAndLogin('profesor');

    const res = await put(idInexistente(), profesor.token, { nombre: 'Da igual' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/cursos/:id — propiedad', () => {
  it('un profesor no puede borrar el curso de otro → 403 y el curso sigue ahí', async () => {
    const { curso } = await profesorConCurso();
    const intruso = await createUserAndLogin('profesor');

    const res = await del(curso._id, intruso.token);

    expect(res.status).toBe(403);
    expect(await Curso.findById(curso._id)).not.toBeNull();
  });

  it('un profesor sí puede borrar el suyo → 200 y desaparece', async () => {
    const { profesor, curso } = await profesorConCurso();

    const res = await del(curso._id, profesor.token);

    expect(res.status).toBe(200);
    expect(await Curso.findById(curso._id)).toBeNull();
  });

  it('un admin puede borrar el curso de cualquiera → 200', async () => {
    const { curso } = await profesorConCurso();
    const admin = await createUserAndLogin('admin');

    await del(curso._id, admin.token).expect(200);

    expect(await Curso.findById(curso._id)).toBeNull();
  });
});
