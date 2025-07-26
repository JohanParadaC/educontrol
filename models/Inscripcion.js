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
  fecha: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Inscripcion', InscripcionSchema);