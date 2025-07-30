const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');

// Crear un usuario
const crearUsuario = async (req, res, next) => {
  try {
    const { nombre, correo, contraseña, rol } = req.body;

    // 1. Verificar que no exista el correo
    const existe = await Usuario.findOne({ correo });
    if (existe) {
      return res.status(400).json({ ok: false, msg: 'Correo ya registrado' });
    }

    // 2. Hashear la contraseña
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(contraseña, salt);

    // 3. Crear y guardar
    const usuario = new Usuario({ nombre, correo, contraseña: passHash, rol });
    await usuario.save();

    // 4. Responder (nunca devuelvas la contraseña)
    const { contraseña: _, ...data } = usuario.toObject();
    res.status(201).json({ ok: true, usuario: data });
  } catch (err) {
    next(err);
  }
};

// Obtener lista de usuarios
const obtenerUsuarios = async (req, res, next) => {
  try {
    const usuarios = await Usuario.find().select('-contraseña');
    res.json({ ok: true, usuarios });
  } catch (err) {
    next(err);
  }
};

// Obtener un usuario por ID
const obtenerUsuarioPorId = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id).select('-contraseña');
    if (!usuario) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    }
    res.json({ ok: true, usuario });
  } catch (err) {
    next(err);
  }
};

// Actualizar usuario
const actualizarUsuario = async (req, res, next) => {
  try {
    // Clonar todos los campos que lleguen en el body
    const updates = { ...req.body };

    // Si se está actualizando la contraseña, rehasearla
    if (updates.contraseña) {
      const salt = await bcrypt.genSalt(10);
      updates.contraseña = await bcrypt.hash(updates.contraseña, salt);
    }

    // Aplicar update con validaciones y devolver el documento nuevo
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-contraseña');

    if (!usuario) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    }
    res.json({ ok: true, usuario });
  } catch (err) {
    next(err);
  }
};

// Borrar usuario
const borrarUsuario = async (req, res, next) => {
  try {
    const usuario = await Usuario.findByIdAndDelete(req.params.id);
    if (!usuario) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    }
    res.json({ ok: true, msg: 'Usuario eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crearUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  borrarUsuario
};