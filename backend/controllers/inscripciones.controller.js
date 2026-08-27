const Inscripcion = require('../models/Inscripcion');
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');
const { leerPaginacion, metadatos } = require('../utils/paginacion');
const { normalizarCorreo } = require('../utils/correo');

/**
 * El curso, con su profesor dentro.
 *
 * El profesor anidado hace falta para pintar "Mis cursos": sin él la pantalla
 * sabe el título pero no quién lo imparte, y la alternativa era pedir el
 * catálogo entero solo para cruzar un nombre.
 */
const POBLAR_CURSO = {
  path: 'curso',
  select: 'nombre descripcion',
  populate: { path: 'profesor', select: 'nombre correo' },
};

/** No coincide con nada. Es la forma de decir "esto no lo puedes ver" sin revelar si existe. */
const NADA = { $in: [] };

/**
 * Cruza la regla del rol con el filtro que pide la query.
 *
 * `permitido` es lo que el rol deja ver (un id, un $in, o undefined si no hay
 * límite) y `pedido` lo que llega por ?curso= o ?estudiante=. Se devuelve la
 * intersección: pedir algo fuera de lo permitido no amplía el resultado, lo
 * vacía.
 */
const cruzar = (permitido, pedido) => {
  if (!pedido) return permitido;
  if (permitido === undefined) return pedido;

  const permitidos = permitido?.$in ? permitido.$in.map(String) : [String(permitido)];

  return permitidos.includes(String(pedido)) ? pedido : NADA;
};

/**
 * Qué inscripciones puede ver quien pregunta, según su rol:
 *   estudiante → las suyas,
 *   profesor   → las de los cursos que imparte,
 *   admin      → todas.
 *
 * Antes esto era `Inscripcion.find()` a secas: cualquier usuario autenticado se
 * llevaba el nombre y el correo de todos los estudiantes del sistema y en qué
 * cursos estaban.
 */
const alcanceDe = async usuario => {
  const rol = usuario?.rol;

  if (rol === 'admin') return {};
  if (rol === 'profesor') {
    const misCursos = await Curso.find({ profesor: usuario._id }).distinct('_id');
    return { curso: { $in: misCursos } };
  }
  return { estudiante: usuario?._id };
};

/**
 * A quién se matricula: por identificador o por correo.
 *
 * El identificador es lo que usa el panel de administración, que tiene la
 * lista de estudiantes delante. El correo existe para el profesor: matricular
 * a alguien en su propio curso es legítimo, pero para elegirlo de un
 * desplegable habría que abrirle `GET /api/usuarios`, y eso es entregarle el
 * nombre y el correo de todos los estudiantes del centro. Por correo hay que
 * conocerlo de antes, que es justo la diferencia.
 *
 * La búsqueda pasa por normalizarCorreo, como todas: el modelo guarda en
 * minúsculas y "Ana@x.com" no encontraría nada.
 */
const resolverEstudiante = ({ estudianteId, correo }) => {
  if (estudianteId) return Usuario.findById(estudianteId).select('rol');
  if (correo) return Usuario.findOne({ correo: normalizarCorreo(correo) }).select('rol');
  return null;
};

/**
 * Inscribe un estudiante en un curso.
 *
 * Antes no se comprobaba nada del contenido: se podía matricular a un
 * administrador en un curso inexistente y el sistema lo aceptaba. Los dos
 * identificadores tienen formato válido —de eso se encarga el validador de la
 * ruta— pero que un ObjectId esté bien escrito no quiere decir que exista.
 */
const inscribirEstudiante = async (req, res, next) => {
  try {
    const { cursoId, estudianteId, correo } = req.body;

    const [curso, estudiante] = await Promise.all([
      Curso.findById(cursoId).select('_id'),
      resolverEstudiante({ estudianteId, correo }),
    ]);

    // El curso no está: 404, porque el recurso al que apunta no existe.
    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'El curso no existe' });
    }

    // El estudiante sí existe pero no es un estudiante: 400, porque el dato
    // que manda el cliente está mal, no falta.
    if (!estudiante) {
      const msg = estudianteId ? 'El estudiante no existe' : 'No hay ninguna cuenta con ese correo';
      return res.status(404).json({ ok: false, msg });
    }
    if (estudiante.rol !== 'estudiante') {
      return res.status(400).json({ ok: false, msg: 'Solo se puede matricular a un estudiante' });
    }

    try {
      const inscripcion = await Inscripcion.create({
        curso: cursoId,
        estudiante: estudiante._id,
      });
      return res.status(201).json({ ok: true, inscripcion });
    } catch (err) {
      // El duplicado lo decide el índice único, no una consulta previa.
      //
      // Antes se hacía un findOne y luego el save. Entre las dos cosas cabe
      // otra petición: las dos leían "no está", las dos insertaban, y la
      // segunda reventaba con un E11000 que salía como 500. Ahora se intenta
      // insertar y se traduce el choque.
      if (err?.code === 11000) {
        return res
          .status(400)
          .json({ ok: false, msg: 'El estudiante ya está inscrito en este curso' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Lista las inscripciones que el solicitante puede ver, con datos poblados.
 *
 * Acepta ?curso= y ?estudiante=, siempre dentro de lo que permite el rol, y
 * pagina con el tope duro de utils/paginacion.js — este listado era el único
 * del proyecto que se lo saltaba.
 */
const obtenerInscripciones = async (req, res, next) => {
  try {
    const alcance = await alcanceDe(req.usuario);

    const filtro = {};
    const porCurso = cruzar(alcance.curso, req.query.curso);
    const porEstudiante = cruzar(alcance.estudiante, req.query.estudiante);
    if (porCurso !== undefined) filtro.curso = porCurso;
    if (porEstudiante !== undefined) filtro.estudiante = porEstudiante;

    const { pagina, limite, saltar } = leerPaginacion(req.query);

    const [inscripciones, total] = await Promise.all([
      Inscripcion.find(filtro)
        .populate('estudiante', 'nombre correo')
        .populate(POBLAR_CURSO)
        .sort({ fecha: -1 })
        .skip(saltar)
        .limit(limite),
      Inscripcion.countDocuments(filtro),
    ]);

    res.json({ ok: true, inscripciones, ...metadatos({ total, pagina, limite }) });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtiene una inscripción por su ID
 */
const obtenerInscripcionPorId = async (req, res, next) => {
  try {
    // El mismo alcance que el listado. Filtrar solo la lista dejaba la fuga
    // abierta de una en una: basta con pedir por id.
    const alcance = await alcanceDe(req.usuario);

    const inscripcion = await Inscripcion.findOne({ _id: req.params.id, ...alcance })
      .populate('estudiante', 'nombre correo')
      .populate(POBLAR_CURSO);

    // 404 y no 403 a propósito: quien no puede verla tampoco tiene por qué
    // saber que existe.
    if (!inscripcion) {
      return res.status(404).json({ ok: false, msg: 'Inscripción no encontrada' });
    }
    res.json({ ok: true, inscripcion });
  } catch (err) {
    next(err);
  }
};

// Aquí vivía `actualizarInscripcion`, detrás de PUT /api/inscripciones/:id.
//
// Pasaba `req.body` entero a findByIdAndUpdate sin lista blanca, así que un
// administrador podía reescribir `estudiante`, `curso` y `fecha` de cualquier
// matrícula: eso no es editar, es fabricar otra. Ninguna pantalla lo usaba.
// Para cambiar de curso se cancela la matrícula y se crea la nueva.

/**
 * Elimina una inscripción.
 *
 * Un estudiante puede darse de baja de la suya; un admin, de cualquiera. Antes
 * la ruta era solo de admin y el estudiante podía entrar en un curso pero no
 * salir: la pantalla "Mis cursos" tenía un botón de cancelar que solo sabía
 * decir que el backend no tenía endpoint.
 *
 * El profesor sigue sin poder: dar de baja a un alumno de su clase es otra
 * cosa —una expulsión, no una baja voluntaria— y no está decidida.
 */
const borrarInscripcion = async (req, res, next) => {
  try {
    const inscripcion = await Inscripcion.findById(req.params.id);
    if (!inscripcion) {
      return res.status(404).json({ ok: false, msg: 'Inscripción no encontrada' });
    }

    const rol = req.usuario?.rol;
    const esSuya = String(inscripcion.estudiante) === String(req.usuario?._id);
    if (rol !== 'admin' && !(rol === 'estudiante' && esSuya)) {
      return res.status(403).json({ ok: false, msg: 'Esta matrícula no es tuya' });
    }

    await Inscripcion.findByIdAndDelete(inscripcion._id);
    res.json({ ok: true, msg: 'Inscripción eliminada' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  inscribirEstudiante,
  obtenerInscripciones,
  obtenerInscripcionPorId,
  borrarInscripcion,
};
