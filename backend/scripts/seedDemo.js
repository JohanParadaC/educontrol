// scripts/seedDemo.js
// ---------------------------------------------------------------------------
// Datos de ejemplo para poder abrir la app y ver algo. Idempotente: si ya hay
// cursos, no toca nada.
//
// Se ejecuta solo con SEED_DEMO=1 o cuando la base es efímera (Mongo en
// memoria), donde siempre arranca vacía.
// ---------------------------------------------------------------------------
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { normalizarCorreo } = require('../utils/correo');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const Auditoria = require('../models/Auditoria');

const PASSWORD_DEMO = process.env.DEMO_PASSWORD || 'Demo1234';

const PROFESORES = [
  { nombre: 'Lucía Fernández', correo: 'lucia@educontrol.com' },
  { nombre: 'Marcos Rivas', correo: 'marcos@educontrol.com' },
];

const ESTUDIANTES = [
  { nombre: 'Ana Torres', correo: 'ana@educontrol.com' },
  { nombre: 'Diego Ruiz', correo: 'diego@educontrol.com' },
  { nombre: 'Sara Molina', correo: 'sara@educontrol.com' },
];

// Los cuatro cursos cubren a propósito las cuatro situaciones que existen:
// con cupo y sitio, con cupo y lleno, cerrado y archivado. Así la aplicación
// recién arrancada enseña los cuatro estados sin que haya que montarlos a mano.
const CURSOS = [
  {
    nombre: 'Angular desde cero',
    descripcion: 'Componentes, routing y formularios reactivos.',
    profesor: 0,
    cupoMaximo: 20,
  },
  {
    nombre: 'Node.js y APIs REST',
    descripcion: 'Express, MongoDB y autenticación con JWT.',
    profesor: 0,
  },
  {
    nombre: 'Testing automatizado',
    descripcion: 'Jest, Supertest y estrategia de cobertura.',
    profesor: 1,
    cupoMaximo: 2, // ya lleno con la matrícula de abajo: enseña el aviso
    estado: 'cerrado',
  },
  {
    nombre: 'Bases de datos con MongoDB',
    descripcion: 'Modelado, índices y agregaciones.',
    profesor: 1,
    estado: 'archivado', // fuera del catálogo del estudiante, no del panel
  },
];

async function crearSiNoExiste({ nombre, correo, rol, hash }) {
  const existente = await Usuario.findOne({ correo: normalizarCorreo(correo) });
  if (existente) return existente;
  return Usuario.create({ nombre, correo, contraseña: hash, rol });
}

module.exports = async function seedDemo() {
  try {
    if (await Curso.countDocuments()) return; // ya hay datos

    const hash = await bcrypt.hash(PASSWORD_DEMO, 10);

    const profesores = [];
    for (const p of PROFESORES) {
      profesores.push(await crearSiNoExiste({ ...p, rol: 'profesor', hash }));
    }

    const estudiantes = [];
    for (const e of ESTUDIANTES) {
      estudiantes.push(await crearSiNoExiste({ ...e, rol: 'estudiante', hash }));
    }

    const cursos = [];
    for (const c of CURSOS) {
      cursos.push(
        await Curso.create({
          nombre: c.nombre,
          descripcion: c.descripcion,
          profesor: profesores[c.profesor]._id,
          ...(c.cupoMaximo ? { cupoMaximo: c.cupoMaximo } : {}),
          ...(c.estado ? { estado: c.estado } : {}),
        })
      );
    }

    // Unas cuantas inscripciones para que los listados no salgan vacíos.
    await Inscripcion.insertMany([
      { estudiante: estudiantes[0]._id, curso: cursos[0]._id },
      { estudiante: estudiantes[0]._id, curso: cursos[2]._id },
      { estudiante: estudiantes[1]._id, curso: cursos[0]._id },
      { estudiante: estudiantes[1]._id, curso: cursos[2]._id }, // deja "Testing" lleno: 2 de 2
      { estudiante: estudiantes[2]._id, curso: cursos[3]._id },
    ]);

    // Un poco de historial. Se escribe a mano porque el registro real lo
    // producen los controladores, y el sembrado no pasa por la API: sin esto,
    // la pestaña de actividad de una aplicación recién arrancada sale vacía y
    // no se entiende para qué está.
    const admin = await Usuario.findOne({ rol: 'admin' });
    if (admin) {
      const hace = minutos => new Date(Date.now() - minutos * 60_000);
      await Auditoria.insertMany([
        {
          actor: admin._id,
          actorNombre: admin.nombre,
          actorRol: 'admin',
          accion: 'curso.creado',
          recurso: { tipo: 'curso', id: cursos[2]._id, etiqueta: cursos[2].nombre },
          despues: { nombre: cursos[2].nombre, estado: 'abierto', cupoMaximo: 2 },
          createdAt: hace(180),
        },
        {
          actor: admin._id,
          actorNombre: admin.nombre,
          actorRol: 'admin',
          accion: 'curso.editado',
          recurso: { tipo: 'curso', id: cursos[2]._id, etiqueta: cursos[2].nombre },
          antes: { estado: 'abierto' },
          despues: { estado: 'cerrado' },
          createdAt: hace(45),
        },
        {
          actor: profesores[1]._id,
          actorNombre: profesores[1].nombre,
          actorRol: 'profesor',
          accion: 'matricula.creada',
          recurso: {
            tipo: 'inscripcion',
            etiqueta: `${estudiantes[2].nombre} en «${cursos[3].nombre}»`,
          },
          despues: { estudiante: estudiantes[2].correo, curso: cursos[3].nombre },
          createdAt: hace(20),
        },
      ]);
    }

    console.log(`🌱 Datos de ejemplo creados. Contraseña para todos: ${PASSWORD_DEMO}`);
    console.log(`   profesor: ${PROFESORES[0].correo} · estudiante: ${ESTUDIANTES[0].correo}`);
  } catch (err) {
    console.error('❌ Error sembrando datos de ejemplo:', err.message);
  }
};
