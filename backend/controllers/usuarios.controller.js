// controllers/usuarios.controller.js
const Usuario = require('../models/Usuario');
const Curso = require('../models/Curso');
const Inscripcion = require('../models/Inscripcion');
const bcrypt = require('bcryptjs');
const { claveProfesorValida, extraerClave } = require('../utils/profesorClave');
const { leerPaginacion, metadatos } = require('../utils/paginacion');
const { normalizarCorreo } = require('../utils/correo');
const { registrar } = require('../utils/auditoria');

const ROLES_PUBLICOS = ['estudiante', 'profesor'];
const ROLES = [...ROLES_PUBLICOS, 'admin'];

/**
 * ¿Es este el último administrador que queda?
 *
 * Se cuenta en el momento, no se cachea: entre dos peticiones puede haber
 * cambiado. Como el cupo de un curso, no es atómico —dos degradaciones
 * simultáneas del penúltimo y el último podrían colarse—, pero cerrar eso pide
 * una transacción y este Mongo es de un solo nodo. Es infinitamente mejor que
 * lo que había, que era nada.
 */
async function esElUltimoAdmin(id) {
  const objetivo = await Usuario.findById(id).select('rol');
  if (objetivo?.rol !== 'admin') return false;
  return (await Usuario.countDocuments({ rol: 'admin' })) <= 1;
}

/** 409 y no 403: no es que no puedas, es que el estado no lo permite todavía. */
const respuestaUltimoAdmin = (res, accion) =>
  res.status(409).json({
    ok: false,
    msg: `Es el único administrador: nombra otro antes de ${accion}.`,
  });

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

    const existe = await Usuario.findOne({ correo: normalizarCorreo(correo) });
    if (existe) return res.status(400).json({ ok: false, msg: 'Correo ya registrado' });

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(contraseña, salt);

    const usuario = new Usuario({ nombre, correo, contraseña: passHash, rol: rolSolicitado });
    await usuario.save();

    const { contraseña: _, ...data } = usuario.toObject();
    res.status(201).json({ ok: true, usuario: data });
  } catch (err) {
    next(err);
  }
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
      Usuario.countDocuments(filtro),
    ]);

    // `usuarios` sigue siendo un array en la misma clave de siempre: los
    // clientes que no paginan no se enteran del cambio.
    res.json({ ok: true, usuarios, ...metadatos({ total, pagina, limite }) });
  } catch (err) {
    next(err);
  }
};

// Obtener por ID
const obtenerUsuarioPorId = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id).select('-contraseña');
    if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    res.json({ ok: true, usuario });
  } catch (err) {
    next(err);
  }
};

// Actualizar (self o admin). Permite cambios parciales.
const updateUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const solicitante = req.usuario; // lo setea el middleware validateJWT

    if (!solicitante) return res.status(401).json({ ok: false, msg: 'No autenticado' });

    const soyElMismo = String(solicitante._id) === String(id);
    const soyAdmin = solicitante.rol === 'admin';

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
            msg: 'Indica tu contraseña actual para poder cambiarla',
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

    // El rol de antes, leído mientras todavía es el de antes.
    const rolPrevio = soyElMismo
      ? solicitante.rol
      : (await Usuario.findById(id).select('rol'))?.rol;

    // Degradar al último administrador deja el sistema sin ninguno, y de eso no
    // se sale desde la aplicación: hay que reiniciar el proceso con
    // ADMIN_PASSWORD para que el sembrado recree la cuenta — y si ese correo ya
    // existe con otro rol, ni eso, porque el sembrado no toca cuentas que ya
    // están (y hace bien).
    //
    // Nada impedía hacerlo: `rol` se valida contra los roles públicos, y un
    // admin está exento de la clave de profesor, así que podía ponerse
    // 'estudiante' a sí mismo de una sola petición.
    if (cambios.rol && rolPrevio === 'admin' && cambios.rol !== 'admin') {
      const sinRelevo = await esElUltimoAdmin(id);
      if (sinRelevo) return respuestaUltimoAdmin(res, 'degradarlo');
    }

    const updated = await Usuario.findByIdAndUpdate(id, cambios, { new: true }).select(
      '-contraseña'
    );
    if (!updated) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    // Se registra el cambio de rol y solo el cambio de rol: cambiar de nombre
    // o de contraseña es cosa de cada cual, pero quién puede hacer qué en la
    // plataforma es exactamente lo que hay que poder reconstruir después.
    if (cambios.rol && cambios.rol !== rolPrevio) {
      registrar({
        actor: solicitante,
        accion: 'rol.cambiado',
        tipo: 'usuario',
        id: updated._id,
        etiqueta: updated.nombre,
        antes: { rol: rolPrevio },
        despues: { rol: updated.rol },
      });
    }

    res.json({ ok: true, usuario: updated });
  } catch (err) {
    next(err);
  }
};

// Borrar
// Borrar usuario, arrastrando lo que dependa de él
const borrarUsuario = async (req, res, next) => {
  try {
    // Se lee antes de borrar: hace falta el rol para decidir qué arrastra.
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    // Borrar al último administrador —incluido uno mismo— deja el sistema sin
    // ninguno, y de eso no se sale desde la aplicación. Mismo 409 que el del
    // profesor con cursos, aquí al lado: no es que no puedas, es que hay algo
    // que hacer antes.
    if (usuario.rol === 'admin' && (await esElUltimoAdmin(usuario._id))) {
      return respuestaUltimoAdmin(res, 'borrarlo');
    }

    // Un profesor con cursos no se borra en silencio.
    //
    // Borrarlo dejaba los cursos apuntando a un id inexistente: `populate`
    // devuelve null y la tarjeta dice "Sin profesor asignado" para siempre.
    // Y borrar en cascada sus cursos destruiría demasiado sin avisar — con
    // ellos se irían las matrículas de todos sus alumnos. Así que se para y se
    // dice cuántos cursos hay que reasignar.
    if (usuario.rol === 'profesor') {
      const cursos = await Curso.countDocuments({ profesor: usuario._id });
      if (cursos > 0) {
        return res.status(409).json({
          ok: false,
          msg: `No se puede eliminar: imparte ${cursos} curso${cursos === 1 ? '' : 's'}. Reasígnalo${cursos === 1 ? '' : 's'} o bórralo${cursos === 1 ? '' : 's'} antes.`,
          cursos,
        });
      }
    }

    // Sus inscripciones sí se van con él: sin esto el profesor seguía viendo
    // en su clase a un alumno que ya no existe.
    const { deletedCount = 0 } = await Inscripcion.deleteMany({ estudiante: usuario._id });
    await Usuario.findByIdAndDelete(usuario._id);

    // Es la acción más destructiva del sistema —se lleva la cuenta y todas sus
    // matrículas— y era la única que no dejaba autor ni fecha. La etiqueta
    // guarda el nombre por lo mismo que en `curso.borrado`: después ya no hay
    // dónde mirarlo.
    registrar({
      actor: req.usuario,
      accion: 'usuario.borrado',
      tipo: 'usuario',
      id: usuario._id,
      etiqueta: usuario.nombre,
      antes: {
        correo: usuario.correo,
        rol: usuario.rol,
        inscripcionesEliminadas: deletedCount,
      },
    });

    res.json({ ok: true, msg: 'Usuario eliminado', inscripcionesEliminadas: deletedCount });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crearUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  updateUsuario, // 👈 export correcto
  borrarUsuario,
};
