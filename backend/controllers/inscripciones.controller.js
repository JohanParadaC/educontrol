const Inscripcion = require('../models/Inscripcion');
const Curso = require('../models/Curso');
const { leerPaginacion, metadatos } = require('../utils/paginacion');

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
 * Inscribe un estudiante en un curso
 */
const inscribirEstudiante = async (req, res, next) => {
  try {
    const { cursoId, estudianteId } = req.body;

    // validar que no exista ya la inscripción
    const yaInscrito = await Inscripcion.findOne({ curso: cursoId, estudiante: estudianteId });
    if (yaInscrito) {
      return res
        .status(400)
        .json({ ok: false, msg: 'El estudiante ya está inscrito en este curso' });
    }

    const inscripcion = new Inscripcion({
      curso: cursoId,
      estudiante: estudianteId,
    });

    await inscripcion.save();
    res.status(201).json({ ok: true, inscripcion });
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

/**
 * Actualiza una inscripción existente
 */
const actualizarInscripcion = async (req, res, next) => {
  try {
    const inscripcionActualizada = await Inscripcion.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('estudiante', 'nombre correo')
      .populate(POBLAR_CURSO);

    if (!inscripcionActualizada) {
      return res.status(404).json({ ok: false, msg: 'Inscripción no encontrada' });
    }
    res.json({ ok: true, inscripcion: inscripcionActualizada });
  } catch (err) {
    next(err);
  }
};

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
  actualizarInscripcion,
  borrarInscripcion,
};
