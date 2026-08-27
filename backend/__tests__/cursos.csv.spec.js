// __tests__/cursos.csv.spec.js
// ---------------------------------------------------------------------------
// GET /api/cursos/:id/estudiantes.csv
//
// Un CSV parece trivial hasta que alguien lo abre. Lo que se comprueba aquí es
// justo lo que se rompe en la práctica: quién puede pedirlo, que un nombre con
// una coma no parta la fila, y que el fichero lleve BOM para que Excel no se
// coma las tildes.
// ---------------------------------------------------------------------------
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const { createUserAndLogin } = require('./helpers');

const exportar = (id, token) =>
  request(app).get(`/api/cursos/${id}/estudiantes.csv`).set('Authorization', `Bearer ${token}`);

async function escenario() {
  const ana = await createUserAndLogin('profesor', { nombre: 'Ana' });
  const bruno = await createUserAndLogin('profesor', { nombre: 'Bruno' });
  const admin = await createUserAndLogin('admin');

  const curso = await Curso.create({ nombre: 'Álgebra, nivel 1', profesor: ana.id });

  // Dos nombres elegidos a mala idea: uno con coma, otro con comillas.
  const conComa = await createUserAndLogin('estudiante', { nombre: 'Ruiz, Nuria' });
  const conComillas = await createUserAndLogin('estudiante', { nombre: 'El "Chino" Pérez' });

  await Inscripcion.create({ estudiante: conComa.id, curso: curso._id });
  await Inscripcion.create({ estudiante: conComillas.id, curso: curso._id });

  return { ana, bruno, admin, curso, conComa, conComillas };
}

describe('GET /api/cursos/:id/estudiantes.csv', () => {
  it('el profesor del curso lo exporta, con cabeceras de descarga', async () => {
    const { ana, curso } = await escenario();

    const res = await exportar(curso._id, ana.token).expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-type']).toContain('charset=utf-8');
    expect(res.headers['content-disposition']).toContain('attachment');
    // Dos nombres: uno en ASCII para clientes antiguos y el de verdad en
    // RFC 5987, porque una cabecera HTTP no puede llevar tildes.
    expect(res.headers['content-disposition']).toMatch(/filename="Algebra_nivel_1[^"]*"/);
    expect(res.headers['content-disposition']).toContain("filename*=UTF-8''");
    // Depende de quién pregunta: no se cachea.
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('lleva BOM para que Excel no rompa las tildes', async () => {
    const { ana, curso } = await escenario();

    const { text } = await exportar(curso._id, ana.token).expect(200);

    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Pérez');
  });

  it('un nombre con coma no parte la fila, y las comillas se duplican', async () => {
    const { ana, curso } = await escenario();

    const { text } = await exportar(curso._id, ana.token).expect(200);

    const lineas = text
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    expect(lineas[0]).toBe('Nombre,Correo,Matriculado el');
    expect(lineas).toHaveLength(3); // cabecera + dos alumnos

    expect(text).toContain('"Ruiz, Nuria"');
    expect(text).toContain('"El ""Chino"" Pérez"');
  });

  it('las filas van por nombre y con la fecha en ISO', async () => {
    const { ana, curso } = await escenario();

    const { text } = await exportar(curso._id, ana.token).expect(200);
    const lineas = text
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');

    expect(lineas[1]).toContain('El ""Chino'); // «El...» antes que «Ruiz...»
    expect(lineas[2]).toContain('Ruiz, Nuria');
    expect(lineas[1]).toMatch(/,\d{4}-\d{2}-\d{2}$/);
  });

  it('el administrador también puede', async () => {
    const { admin, curso } = await escenario();

    await exportar(curso._id, admin.token).expect(200);
  });

  it('un profesor ajeno no exporta un curso que no imparte', async () => {
    const { bruno, curso, conComa } = await escenario();

    const res = await exportar(curso._id, bruno.token).expect(403);

    expect(JSON.stringify(res.body)).not.toContain(conComa.correo);
  });

  it('un estudiante matriculado tampoco exporta la lista de sus compañeros', async () => {
    const { curso, conComa, conComillas } = await escenario();

    const res = await exportar(curso._id, conComa.token).expect(403);

    expect(res.text).not.toContain(conComillas.correo);
  });

  it('sin token, 401', async () => {
    const { curso } = await escenario();

    await request(app).get(`/api/cursos/${curso._id}/estudiantes.csv`).expect(401);
  });

  it('un curso que no existe es 404', async () => {
    const { token } = await createUserAndLogin('admin');

    await exportar(new mongoose.Types.ObjectId(), token).expect(404);
  });

  it('un curso sin alumnos exporta solo la cabecera, no un error', async () => {
    const ana = await createUserAndLogin('profesor');
    const curso = await Curso.create({ nombre: 'Vacío', profesor: ana.id });

    const { text } = await exportar(curso._id, ana.token).expect(200);

    expect(text.replace(/^\uFEFF/, '').trim()).toBe('Nombre,Correo,Matriculado el');
  });
});
