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
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');

const PASSWORD_DEMO = process.env.DEMO_PASSWORD || 'Demo1234';

const PROFESORES = [
  { nombre: 'Lucía Fernández', correo: 'lucia@educontrol.com' },
  { nombre: 'Marcos Rivas',    correo: 'marcos@educontrol.com' }
];

const ESTUDIANTES = [
  { nombre: 'Ana Torres',   correo: 'ana@educontrol.com' },
  { nombre: 'Diego Ruiz',   correo: 'diego@educontrol.com' },
  { nombre: 'Sara Molina',  correo: 'sara@educontrol.com' }
];

const CURSOS = [
  { nombre: 'Angular desde cero',        descripcion: 'Componentes, routing y formularios reactivos.', profesor: 0 },
  { nombre: 'Node.js y APIs REST',       descripcion: 'Express, MongoDB y autenticación con JWT.',     profesor: 0 },
  { nombre: 'Testing automatizado',      descripcion: 'Jest, Supertest y estrategia de cobertura.',    profesor: 1 },
  { nombre: 'Bases de datos con MongoDB', descripcion: 'Modelado, índices y agregaciones.',            profesor: 1 }
];

async function crearSiNoExiste({ nombre, correo, rol, hash }) {
  const existente = await Usuario.findOne({ correo });
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
      cursos.push(await Curso.create({
        nombre: c.nombre,
        descripcion: c.descripcion,
        profesor: profesores[c.profesor]._id
      }));
    }

    // Unas cuantas inscripciones para que los listados no salgan vacíos.
    await Inscripcion.insertMany([
      { estudiante: estudiantes[0]._id, curso: cursos[0]._id },
      { estudiante: estudiantes[0]._id, curso: cursos[2]._id },
      { estudiante: estudiantes[1]._id, curso: cursos[0]._id },
      { estudiante: estudiantes[2]._id, curso: cursos[3]._id }
    ]);

    console.log(`🌱 Datos de ejemplo creados. Contraseña para todos: ${PASSWORD_DEMO}`);
    console.log(`   profesor: ${PROFESORES[0].correo} · estudiante: ${ESTUDIANTES[0].correo}`);
  } catch (err) {
    console.error('❌ Error sembrando datos de ejemplo:', err.message);
  }
};
