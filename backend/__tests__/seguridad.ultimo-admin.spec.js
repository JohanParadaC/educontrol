// __tests__/seguridad.ultimo-admin.spec.js
// ---------------------------------------------------------------------------
// Dos agujeros que dejaban el sistema sin ningún administrador, los dos
// irreversibles desde la propia aplicación.
//
// `updateUsuario` valida el rol contra los roles públicos y exime al admin de
// la clave de profesor, así que un admin podía ponerse 'estudiante' a sí mismo
// de una sola petición. `borrarUsuario` solo protegía a un profesor con cursos,
// así que también podía borrarse.
//
// Salir de ahí exige reiniciar el proceso con ADMIN_PASSWORD para que el
// sembrado recree la cuenta — y si ese correo ya existe con otro rol, ni eso,
// porque el sembrado no toca cuentas que ya están (y hace bien).
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../app');
const Usuario = require('../models/Usuario');
const Auditoria = require('../models/Auditoria');
const Inscripcion = require('../models/Inscripcion');
const Curso = require('../models/Curso');
const { createUserAndLogin, crearUsuario } = require('./helpers');

const auth = token => ({ Authorization: `Bearer ${token}` });

const degradar = (token, id, rol = 'estudiante') =>
  request(app).put(`/api/usuarios/${id}`).set(auth(token)).send({ rol });

const borrar = (token, id) => request(app).delete(`/api/usuarios/${id}`).set(auth(token));

const rolDe = async id => (await Usuario.findById(id).select('rol'))?.rol;

/** El registro se escribe sin esperarlo: se espera a que aparezca. */
async function esperarRegistros(cuantos, intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    const filas = await Auditoria.find().lean();
    if (filas.length >= cuantos) return filas;
    await new Promise(r => setTimeout(r, 25));
  }
  return Auditoria.find().lean();
}

describe('El último administrador no se puede quedar sin relevo', () => {
  it('no puede degradarse a sí mismo: 409 y sigue siendo admin', async () => {
    const admin = await createUserAndLogin('admin');

    const { body } = await degradar(admin.token, admin.id).expect(409);

    expect(body.msg).toMatch(/único administrador/i);
    expect(await rolDe(admin.id)).toBe('admin');
  });

  it('ni otro admin puede degradarlo, si es el único que queda', async () => {
    const admin = await createUserAndLogin('admin');

    // Se degrada desde su propia sesión, que es el caso real: no hay otro
    // administrador que pudiera hacerlo.
    await degradar(admin.token, admin.id, 'profesor').expect(409);
    expect(await rolDe(admin.id)).toBe('admin');
  });

  it('no puede borrarse: 409 y la cuenta sigue ahí', async () => {
    const admin = await createUserAndLogin('admin');

    const { body } = await borrar(admin.token, admin.id).expect(409);

    expect(body.msg).toMatch(/único administrador/i);
    expect(await Usuario.findById(admin.id)).not.toBeNull();
  });

  it('con DOS administradores, las dos operaciones funcionan', async () => {
    const uno = await createUserAndLogin('admin');
    const dos = await crearUsuario({ rol: 'admin' });

    // Degradar a uno de los dos: queda el otro, así que adelante.
    await degradar(uno.token, dos.id, 'profesor').expect(200);
    expect(await rolDe(dos.id)).toBe('profesor');

    // Y ahora el que queda ya es el único: no puede irse.
    await borrar(uno.token, uno.id).expect(409);

    // Con relevo, sí.
    const tres = await crearUsuario({ rol: 'admin' });
    await borrar(uno.token, uno.id).expect(200);
    expect(await Usuario.findById(uno.id)).toBeNull();
    expect(await rolDe(tres.id)).toBe('admin');
  });

  it('borrar a alguien que no es admin no se ve afectado', async () => {
    const admin = await createUserAndLogin('admin');
    const alumno = await crearUsuario({ rol: 'estudiante' });

    await borrar(admin.token, alumno.id).expect(200);
    expect(await Usuario.findById(alumno.id)).toBeNull();
  });
});

describe('Borrar una cuenta deja rastro', () => {
  it('registra quién, a quién y qué se llevó por delante', async () => {
    const admin = await createUserAndLogin('admin', { nombre: 'Jefa' });
    const profesor = await crearUsuario({ rol: 'profesor' });
    const curso = await Curso.create({ nombre: 'Álgebra', profesor: profesor.id });
    const alumno = await crearUsuario({ rol: 'estudiante', nombre: 'Nuria' });
    await Inscripcion.create({ estudiante: alumno.id, curso: curso._id });

    await borrar(admin.token, alumno.id).expect(200);

    const [fila] = await esperarRegistros(1);

    expect(fila.accion).toBe('usuario.borrado');
    expect(fila.actorNombre).toBe('Jefa');
    // El nombre congelado: después de borrar ya no hay dónde mirarlo, igual
    // que en `curso.borrado`.
    expect(fila.recurso).toMatchObject({ tipo: 'usuario', etiqueta: 'Nuria' });
    expect(fila.antes).toMatchObject({
      correo: alumno.correo,
      rol: 'estudiante',
      inscripcionesEliminadas: 1,
    });
  });

  it('un borrado que NO llega a ocurrir no se registra', async () => {
    const admin = await createUserAndLogin('admin');

    await borrar(admin.token, admin.id).expect(409);

    await new Promise(r => setTimeout(r, 200));
    expect(await Auditoria.countDocuments()).toBe(0);
  });

  it('el historial admite filtrar por la acción nueva', async () => {
    const admin = await createUserAndLogin('admin');
    const alumno = await crearUsuario({ rol: 'estudiante' });

    await borrar(admin.token, alumno.id).expect(200);
    await esperarRegistros(1);

    const { body } = await request(app)
      .get('/api/auditoria?accion=usuario.borrado')
      .set(auth(admin.token))
      .expect(200);

    expect(body.registros).toHaveLength(1);
  });
});
