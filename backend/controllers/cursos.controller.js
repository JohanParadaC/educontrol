const Curso = require('../models/Curso');

// Crear un curso
const crearCurso = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    const curso = new Curso({
      nombre,
      descripcion,
      profesor: req.uid   
    });
    await curso.save();
    res.status(201).json({ ok: true, curso });
  } catch (err) {
    next(err);
  }
};

// Obtener todos los cursos
const obtenerCursos = async (req, res, next) => {
  try {
    const cursos = await Curso.find()
      .populate('profesor', 'nombre correo');
    res.json({ ok: true, cursos });
  } catch (err) {
    next(err);
  }
};

// Obtener un curso por ID
const obtenerCursoPorId = async (req, res, next) => {
  try {
    const curso = await Curso.findById(req.params.id)
      .populate('profesor', 'nombre correo');
    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'Curso no encontrado' });
    }
    res.json({ ok: true, curso });
  } catch (err) {
    next(err);
  }
};

// Actualizar curso
const actualizarCurso = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    const curso = await Curso.findByIdAndUpdate(
      req.params.id,
      { nombre, descripcion },
      { new: true, runValidators: true }
    )
    .populate('profesor', 'nombre correo');

    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'Curso no encontrado' });
    }
    res.json({ ok: true, curso });
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
    res.json({ ok: true, msg: 'Curso eliminado' });
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