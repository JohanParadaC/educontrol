const Inscripcion = require('../models/Inscripcion');

/**
 * Inscribe un estudiante en un curso
 */
const inscribirEstudiante = async (req, res, next) => {
  try {
    const { cursoId, estudianteId } = req.body;

    // validar que no exista ya la inscripción
    const yaInscrito = await Inscripcion.findOne({ curso: cursoId, estudiante: estudianteId });
    if (yaInscrito) {
      return res.status(400).json({ ok: false, msg: 'El estudiante ya está inscrito en este curso' });
    }

    const inscripcion = new Inscripcion({
      curso: cursoId,
      estudiante: estudianteId
    });

    await inscripcion.save();
    res.status(201).json({ ok: true, inscripcion });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtiene todas las inscripciones, con datos poblados
 */
const obtenerInscripciones = async (req, res, next) => {
  try {
    const inscripciones = await Inscripcion.find()
      .populate('estudiante', 'nombre correo')
      .populate('curso', 'nombre descripcion');
    res.json({ ok: true, inscripciones });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtiene una inscripción por su ID
 */
const obtenerInscripcionPorId = async (req, res, next) => {
  try {
    const inscripcion = await Inscripcion.findById(req.params.id)
      .populate('estudiante', 'nombre correo')
      .populate('curso', 'nombre descripcion');
    if (!inscripcion) {
      return res.status(404).json({ ok: false, msg: 'Inscripción no encontrada' });
    }
    res.json({ ok: true, inscripcion });
  } catch (err) {
    next(err);
  }
};

/**
 * Actualiza una inscripción existente
 */
const actualizarInscripcion = async (req, res, next) => {
  try {
    const inscripcionActualizada = await Inscripcion.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    .populate('estudiante', 'nombre correo')
    .populate('curso', 'nombre descripcion');

    if (!inscripcionActualizada) {
      return res.status(404).json({ ok: false, msg: 'Inscripción no encontrada' });
    }
    res.json({ ok: true, inscripcion: inscripcionActualizada });
  } catch (err) {
    next(err);
  }
};

/**
 * Elimina una inscripción
 */
const borrarInscripcion = async (req, res, next) => {
  try {
    const inscripcion = await Inscripcion.findByIdAndDelete(req.params.id);
    if (!inscripcion) {
      return res.status(404).json({ ok: false, msg: 'Inscripción no encontrada' });
    }
    res.json({ ok: true, msg: 'Inscripción eliminada' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  inscribirEstudiante,
  obtenerInscripciones,
  obtenerInscripcionPorId,
  actualizarInscripcion,
  borrarInscripcion
};