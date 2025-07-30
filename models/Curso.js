
const mongoose = require('mongoose');

const CursoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  descripcion: {
    type: String
    // OPCIONAL: podrías añadir minlength o maxlength aquí si lo necesitas
  },
  profesor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  }
},
// OPCIONAL: si quieres guardar createdAt/updatedAt, descomenta la siguiente línea
// { timestamps: true }
);

// NINGUNA LÍNEA FUE ELIMINADA; el esquema cumple con los requisitos actuales

module.exports = mongoose.model('Curso', CursoSchema);