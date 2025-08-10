const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  correo: {
    type: String,
    required: true,
    unique: true, // índice único para evitar duplicados
    match: [/^\S+@\S+\.\S+$/, 'Correo no válido']      // validación básica de formato de correo
  },
  contraseña: {
    type: String,
    required: true,
    //longitud mínima de contraseña para mayor seguridad
    minlength: 6
    //esta validación se aplica antes de hashear
  },
  rol: {
    type: String,
    enum: ['estudiante', 'profesor', 'admin'],
    required: true
  }
});

//Ocultar campos sensibles (__v, contraseña) y renombrar _id → id
UsuarioSchema.methods.toJSON = function() {
  const { __v, contraseña, _id, ...usuario } = this.toObject();
  usuario.id = _id;
  return usuario;
};

module.exports = mongoose.model('Usuario', UsuarioSchema);