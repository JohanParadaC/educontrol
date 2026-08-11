// controllers/usuarios.controller.js
const Usuario = require('../models/Usuario');
const bcrypt  = require('bcryptjs');
const { claveProfesorValida, extraerClave } = require('../utils/profesorClave');
const { leerPaginacion, metadatos } = require('../utils/paginacion');

const ROLES_PUBLICOS = ['estudiante', 'profesor'];
const ROLES = [...ROLES_PUBLICOS, 'admin'];

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

// Listar usuarios (paginado, con filtro opcional por rol)
const obtenerUsuarios = async (req, res, next) => {
  try {
    const { pagina, limite, saltar } = leerPaginacion(req.query);

    // ?rol=profesor evita que un desplegable tenga que tragarse la tabla entera
    // para encontrar a los profesores. Se ignora si no es un rol conocido.
    const filtro = {};
    if (ROLES.includes(req.query.rol)) filtro.rol = req.query.rol;

    const [usuarios, total] = await Promise.all([
      Usuario.find(filtro).select('-contraseña').sort({ nombre: 1 }).skip(saltar).limit(limite),
      Usuario.countDocuments(filtro)
    ]);

    // `usuarios` sigue siendo un array en la misma clave de siempre: los
    // clientes que no paginan no se enteran del cambio.
    res.json({ ok: true, usuarios, ...metadatos({ total, pagina, limite }) });
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
    const contraseñaActual = req.body?.contraseñaActual ?? req.body?.passwordActual;

    if (nombre !== undefined) cambios.nombre = nombre;
    if (correo !== undefined) cambios.correo = correo;

    if (contraseña) {
      // 🔒 Reautenticación: cambiar tu propia contraseña exige demostrar que
      // conoces la actual. Sin esto, una sesión olvidada abierta un minuto es
      // suficiente para que un tercero se quede la cuenta para siempre.
      //
      // Un admin actuando sobre OTRA cuenta queda exento: es una acción
      // administrativa (restablecer el acceso de alguien), no un cambio propio.
      if (soyElMismo) {
        if (!contraseñaActual) {
          return res.status(400).json({
            ok: false,
            msg: 'Indica tu contraseña actual para poder cambiarla'
          });
        }

        // req.usuario viene sin el hash (validateJWT hace select('-contraseña')),
        // así que lo pedimos explícitamente.
        const cuenta = await Usuario.findById(id);
        if (!cuenta) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

        const coincide = await bcrypt.compare(String(contraseñaActual), cuenta.contraseña);
        if (!coincide) {
          return res.status(403).json({ ok: false, msg: 'La contraseña actual no es correcta' });
        }
      }

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