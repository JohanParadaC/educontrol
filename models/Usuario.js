const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  correo: {
    type: String,
    required: true,
    unique: true, // YA EXISTENTE: índice único para evitar duplicados
    // AÑADIDO: validación básica de formato de correo
    match: [/^\S+@\S+\.\S+$/, 'Correo no válido']
  },
  contraseña: {
    type: String,
    required: true,
    // AÑADIDO: longitud mínima de contraseña para mayor seguridad
    minlength: 6
    // Nota: esta validación se aplica antes de hashear
  },
  rol: {
    type: String,
    enum: ['estudiante', 'profesor', 'admin'],
    required: true
  }
});

// AÑADIDO: Ocultar campos sensibles (__v, contraseña) y renombrar _id → id
UsuarioSchema.methods.toJSON = function() {
  const { __v, contraseña, _id, ...usuario } = this.toObject();
  usuario.id = _id;
  return usuario;
};

// NINGUNA LÍNEA FUE ELIMINADA; sólo se agregaron validaciones y el método toJSON

module.exports = mongoose.model('Usuario', UsuarioSchema);