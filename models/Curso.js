const mongoose = require('mongoose');

const CursoSchema = new mongoose.Schema({
    nombre: {type: String, required: true},
    descripcion: String,
    profesor:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    }
})
module.exports = mongoose.model('Curso', CursoSchema);