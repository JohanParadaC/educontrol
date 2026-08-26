const mongoose = require('mongoose');

const InscripcionSchema = new mongoose.Schema(
  {
    estudiante: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    curso: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curso',
      required: true,
    },
    // `createdAt` (de timestamps) dice exactamente lo mismo y lo pone Mongoose
    // solo. `fecha` se queda porque hay documentos y respuestas que la usan:
    // quitarla es una migración, no un cambio de esquema. Para código nuevo,
    // createdAt.
    fecha: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// índice compuesto único para prevenir inscripciones duplicadas
InscripcionSchema.index({ estudiante: 1, curso: 1 }, { unique: true });

module.exports = mongoose.model('Inscripcion', InscripcionSchema);
