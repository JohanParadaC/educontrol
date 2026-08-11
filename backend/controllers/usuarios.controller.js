// controllers/usuarios.controller.js
const Usuario = require('../models/Usuario');
const bcrypt  = require('bcryptjs');
const { claveProfesorValida, extraerClave } = require('../utils/profesorClave');

const ROLES_PUBLICOS = ['estudiante', 'profesor'];

// Crear un usuario (registro público)
const crearUsuario = async (req, res, next) => {
  try {
    const { nombre, correo, contraseña, rol } = req.body;

    // El registro es anónimo: nunca se acepta 'admin', venga como venga el body.
    const rolSolicitado = ROLES_PUBLICOS.includes(rol) ? rol : 'estudiante';

    // Y 'profesor' exige la clave que el frontend ya pedía en su diálogo.
    if (rolSolicitado === 'profesor' && !claveProfesorValida(extraerClave(req.body))) {
      return res.status(403).json({ ok: false, msg: 'Clave de profesor inválida' });
    }

    const existe = await Usuario.findOne({ correo });
    if (existe) return res.status(400).json({ ok: false, msg: 'Correo ya registrado' });

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(contraseña, salt);

    const usuario = new Usuario({ nombre, correo, contraseña: passHash, rol: rolSolicitado });
    await usuario.save();

    const { contraseña: _, ...data } = usuario.toObject();
    res.status(201).json({ ok: true, usuario: data });
  } catch (err) { next(err); }
};

// Listar usuarios
const obtenerUsuarios = async (req, res, next) => {
  try {
    const usuarios = await Usuario.find().select('-contraseña');
    res.json({ ok: true, usuarios });
  } catch (err) { next(err); }
};

// Obtener por ID
const obtenerUsuarioPorId = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id).select('-contraseña');
    if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    res.json({ ok: true, usuario });
  } catch (err) { next(err); }
};

// Actualizar (self o admin). Permite cambios parciales.
const updateUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const solicitante = req.usuario; // lo setea el middleware validateJWT

    if (!solicitante) return res.status(401).json({ ok: false, msg: 'No autenticado' });

    const soyElMismo = String(solicitante._id) === String(id);
    const soyAdmin   = solicitante.rol === 'admin';

    // 🔒 Propiedad, ANTES de mirar el body.
    // Antes esta comprobación solo se hacía dentro del bloque de 'rol': nombre,
    // correo y contraseña se aplicaban a cualquier id, así que un estudiante
    // autenticado podía cambiarle la contraseña al admin.
    if (!soyElMismo && !soyAdmin) {
      return res.status(403).json({ ok: false, msg: 'No autorizado para modificar este usuario' });
    }

    const cambios = {};
    const { nombre, correo, rol, contraseña } = req.body || {};

    if (nombre !== undefined) cambios.nombre = nombre;
    if (correo !== undefined) cambios.correo = correo;

    if (contraseña) {
      const salt = await bcrypt.genSalt(10);
      cambios.contraseña = await bcrypt.hash(contraseña, salt);
    }

    if (rol !== undefined) {
      if (!ROLES_PUBLICOS.includes(rol)) {
        return res.status(400).json({ ok: false, msg: 'Rol inválido' });
      }

      // Ascender a profesor exige la clave, salvo que lo haga un admin.
      // Este era el agujero que dejaba el diálogo de clave del frontend a medias:
      // la clave se pedía en pantalla pero el backend no la leía nunca.
      if (rol === 'profesor' && !soyAdmin && !claveProfesorValida(extraerClave(req.body))) {
        return res.status(403).json({ ok: false, msg: 'Clave de profesor inválida' });
      }

      cambios.rol = rol;
    }

    const updated = await Usuario.findByIdAndUpdate(id, cambios, { new: true }).select('-contraseña');
    if (!updated) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    res.json({ ok: true, usuario: updated });
  } catch (err) { next(err); }
};

// Borrar
const borrarUsuario = async (req, res, next) => {
  try {
    const usuario = await Usuario.findByIdAndDelete(req.params.id);
    if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    res.json({ ok: true, msg: 'Usuario eliminado' });
  } catch (err) { next(err); }
};

module.exports = {
  crearUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  updateUsuario,          // 👈 export correcto
  borrarUsuario
};