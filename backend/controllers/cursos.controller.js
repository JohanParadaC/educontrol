const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario'); // CAMBIO: lo usamos para validar el profesor

// Crear un curso
const crearCurso = async (req, res, next) => {
  try {
    // CAMBIO: ahora leemos también "profesor" del body
    const { nombre, descripcion, profesor } = req.body;

    // CAMBIO: resolver profesorId correctamente
    // - Si viene en el body, usarlo.
    // - Si NO viene y el que crea es profesor, usar req.uid (él mismo).
    // - Si NO viene y el que crea es admin, devolver 400 (requerido).
    let profesorId = profesor;
    if (!profesorId) {
      if (req.usuario?.rol === 'profesor') {
        profesorId = req.uid;
      } else {
        return res
          .status(400)
          .json({ ok: false, msg: 'El campo "profesor" es requerido' });
      }
    }

    // CAMBIO: validar que exista y sea rol "profesor"
    const profDoc = await Usuario.findById(profesorId);
    if (!profDoc || profDoc.rol !== 'profesor') {
      return res.status(400).json({ ok: false, msg: 'Profesor inválido' });
    }

    // Crear curso con el profesor resuelto
    const curso = await Curso.create({ nombre, descripcion, profesor: profesorId });

    // CAMBIO: devolver populado para que el front lo vea al instante
    await curso.populate('profesor', 'nombre correo');
    return res.status(201).json({ ok: true, curso });
  } catch (err) {
    next(err);
  }
};

// Obtener todos los cursos
const obtenerCursos = async (req, res, next) => {
  try {
    const cursos = await Curso.find().populate('profesor', 'nombre correo');
    return res.json({ ok: true, cursos });
  } catch (err) {
    next(err);
  }
};

// Obtener un curso por ID
const obtenerCursoPorId = async (req, res, next) => {
  try {
    const curso = await Curso.findById(req.params.id).populate('profesor', 'nombre correo');
    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'Curso no encontrado' });
    }
    return res.json({ ok: true, curso });
  } catch (err) {
    next(err);
  }
};

// Actualizar curso
const actualizarCurso = async (req, res, next) => {
  try {
    // CAMBIO: aceptar profesor en el PUT
    const { nombre, descripcion, profesor } = req.body;

    // Construimos el update SOLO con los campos enviados
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (descripcion !== undefined) update.descripcion = descripcion;

    // CAMBIO: si viene "profesor", validarlo y aplicarlo
    if (profesor !== undefined && profesor !== null && profesor !== '') {
      const profDoc = await Usuario.findById(profesor);
      if (!profDoc || profDoc.rol !== 'profesor') {
        return res.status(400).json({ ok: false, msg: 'Profesor inválido' });
      }
      update.profesor = profesor;
    }

    const curso = await Curso
      .findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('profesor', 'nombre correo');

    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'Curso no encontrado' });
    }
    return res.json({ ok: true, curso });
  } catch (err) {
    next(err);
  }
};

// Borrar curso
const borrarCurso = async (req, res, next) => {
  try {
    const curso = await Curso.findByIdAndDelete(req.params.id);
    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'Curso no encontrado' });
    }
    return res.json({ ok: true, msg: 'Curso eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crearCurso,
  obtenerCursos,
  obtenerCursoPorId,
  actualizarCurso,
  borrarCurso
};