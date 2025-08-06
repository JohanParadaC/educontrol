
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

);


module.exports = mongoose.model('Curso', CursoSchema);