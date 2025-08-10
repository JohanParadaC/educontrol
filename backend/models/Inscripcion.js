
const mongoose = require('mongoose');

const InscripcionSchema = new mongoose.Schema({
  estudiante: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  curso: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Curso',
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

// índice compuesto único para prevenir inscripciones duplicadas
InscripcionSchema.index({ estudiante: 1, curso: 1 }, { unique: true });

module.exports = mongoose.model('Inscripcion', InscripcionSchema);