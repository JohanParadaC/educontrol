// __tests__/cursos.detalle.tope.spec.js
// ---------------------------------------------------------------------------
// La lista de matriculados de la ficha se corta en el tope del proyecto.
//
// Era el último listado sin límite. Se comprueba también lo que NO cambia: la
// clave `estudiantes` sigue siendo ausente-o-lista, porque el frontend usa su
// presencia como señal de permiso y `[]` significa "no hay ninguno".
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const Usuario = require('../models/Usuario');
const { LIMITE_MAXIMO } = require('../utils/paginacion');
const { createUserAndLogin, crearUsuario, uniqueEmail } = require('./helpers');

/** Matricula a `cuantos` estudiantes recién creados, sin pasar por la API. */
async function matricular(cursoId, cuantos) {
  const alumnos = await Usuario.insertMany(
    Array.from({ length: cuantos }, (_, i) => ({
      // El nombre va con índice acolchado para que el orden alfabético sea
      // predecible y no dependa de la configuración regional de la máquina.
      nombre: `Alumno ${String(i).padStart(4, '0')}`,
      correo: uniqueEmail(`alumno${i}`),
      ['contraseña']: 'x'.repeat(60),
      rol: 'estudiante',
    }))
  );
  await Inscripcion.insertMany(alumnos.map(a => ({ curso: cursoId, estudiante: a._id })));
  return alumnos;
}

const pedirFicha = (id, token) =>
  request(app).get(`/api/cursos/${id}`).set('Authorization', `Bearer ${token}`);

describe('Ficha de curso: tope de la lista de matriculados', () => {
  let profesor;
  let curso;

  beforeEach(async () => {
    profesor = await createUserAndLogin('profesor');
    curso = await Curso.create({ nombre: 'Cálculo', profesor: profesor.id });
  });

  it(`con ${LIMITE_MAXIMO + 1} matrículas devuelve ${LIMITE_MAXIMO} y avisa del corte`, async () => {
    await matricular(curso._id, LIMITE_MAXIMO + 1);

    const res = await pedirFicha(curso._id, profesor.token);

    expect(res.status).toBe(200);
    expect(res.body.estudiantes).toHaveLength(LIMITE_MAXIMO);
    expect(res.body.estudiantesTruncados).toBe(true);
    // El total sigue siendo el de verdad: la interfaz tiene los dos números.
    expect(res.body.matriculados).toBe(LIMITE_MAXIMO + 1);
  });

  it('con pocas matrículas las devuelve todas y sin la marca', async () => {
    await matricular(curso._id, 3);

    const res = await pedirFicha(curso._id, profesor.token);

    expect(res.body.estudiantes).toHaveLength(3);
    expect(res.body.matriculados).toBe(3);
    expect(res.body.estudiantesTruncados).toBeUndefined();
  });

  it('un curso vacío devuelve [] y no la clave ausente', async () => {
    const res = await pedirFicha(curso._id, profesor.token);

    // `[]` es "no hay nadie"; omitir la clave sería "no puedes verlos". La
    // diferencia es la señal de permiso del frontend y no se toca.
    expect(res.body.estudiantes).toEqual([]);
    expect(res.body.matriculados).toBe(0);
  });

  it('a un estudiante se le sigue omitiendo la clave entera, haya cuantos haya', async () => {
    await matricular(curso._id, LIMITE_MAXIMO + 1);
    const intruso = await createUserAndLogin('estudiante');

    const res = await pedirFicha(curso._id, intruso.token);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('estudiantes');
    expect(res.body).not.toHaveProperty('estudiantesTruncados');
    expect(res.body.matriculados).toBe(LIMITE_MAXIMO + 1);
  });

  it('el CSV no tiene tope: para eso está', async () => {
    await matricular(curso._id, LIMITE_MAXIMO + 1);

    const res = await request(app)
      .get(`/api/cursos/${curso._id}/estudiantes.csv`)
      .set('Authorization', `Bearer ${profesor.token}`);

    expect(res.status).toBe(200);
    // Cabecera + una fila por matrícula.
    const filas = res.text.trim().split('\n');
    expect(filas).toHaveLength(LIMITE_MAXIMO + 2);
  });

  it('la página recortada llega ordenada por nombre', async () => {
    await matricular(curso._id, LIMITE_MAXIMO + 1);
    // Alguien que alfabéticamente va el último pero se matriculó el primero:
    // si el corte se llevara la ordenación por delante, se colaría o faltaría.
    const rezagado = await crearUsuario({ rol: 'estudiante', nombre: 'Zzz Última' });
    await Inscripcion.create({ curso: curso._id, estudiante: rezagado.id });

    const { body } = await pedirFicha(curso._id, profesor.token);
    const nombres = body.estudiantes.map(e => e.nombre);

    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')));
    expect(body.matriculados).toBe(LIMITE_MAXIMO + 2);
  });
});
