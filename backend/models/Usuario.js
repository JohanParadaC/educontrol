const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    correo: {
      type: String,
      required: true,
      unique: true, // índice único para evitar duplicados
      // Sin lowercase, "Ana@x.com" y "ana@x.com" son dos cuentas distintas y el
      // índice único no lo impide: para Mongo son valores diferentes. Quien se
      // registró en mayúsculas no puede entrar escribiendo su correo normal.
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Correo no válido'], // validación básica de formato de correo
    },
    contraseña: {
      type: String,
      required: true,
      //longitud mínima de contraseña para mayor seguridad
      minlength: 6,
      //esta validación se aplica antes de hashear
    },
    rol: {
      type: String,
      enum: ['estudiante', 'profesor', 'admin'],
      required: true,
      // Los desplegables de profesor y estudiante piden ?rol=, que sin índice
      // recorre la colección entera.
      index: true,
    },
  },
  // Saber cuándo se creó o se modificó una cuenta no se puede reconstruir
  // después: o se guarda desde el principio o se pierde.
  { timestamps: true }
);

//Ocultar campos sensibles (__v, contraseña) y renombrar _id → id
UsuarioSchema.methods.toJSON = function () {
  const { __v, contraseña, _id, ...usuario } = this.toObject();
  usuario.id = _id;
  return usuario;
};

module.exports = mongoose.model('Usuario', UsuarioSchema);
