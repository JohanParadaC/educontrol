const Inscripcion = require('../models/Inscripcion');
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');
const { leerPaginacion, metadatos } = require('../utils/paginacion');
const { normalizarCorreo } = require('../utils/correo');
const { registrar } = require('../utils/auditoria');
const { puedeGestionarCurso, esElMismo } = require('../utils/propiedad');

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
  // El nombre no es decorado: es la etiqueta que se guarda en el registro de
  // auditoría, que tiene que seguir leyéndose si la cuenta desaparece.
  const campos = 'rol nombre correo';
  if (estudianteId) return Usuario.findById(estudianteId).select(campos);
  if (correo) return Usuario.findOne({ correo: normalizarCorreo(correo) }).select(campos);
  return null;
};

/**
 * ¿Puede quien pide matricular a quien dice, en el curso que dice?
 *
 *   admin       a cualquiera, en cualquier curso.
 *   profesor    a cualquiera, pero SOLO en los cursos que imparte. Por lo
 *               mismo por lo que no edita cursos ajenos: el rol dice qué clase
 *               de usuario entra, de quién es el curso lo decide leerlo.
 *   estudiante  solo a sí mismo.
 *
 * Devuelve `null` si puede, o el motivo si no. Se resuelve mirando lo que pide,
 * sin tocar la cuenta a la que apunta: eso es lo que impide usar esta ruta para
 * averiguar si un correo existe.
 */
const motivoParaNegar = ({ usuario, curso, estudianteId, correo }) => {
  if (usuario?.rol === 'admin') return null;

  if (usuario?.rol === 'profesor') {
    return puedeGestionarCurso(curso, usuario)
      ? null
      : 'Solo puedes matricular en los cursos que impartes';
  }

  // Un estudiante, solo a sí mismo: sin destinatario (se matricula él), con su
  // propio identificador, o con su propio correo.
  const aOtroPorId = estudianteId && !esElMismo(estudianteId, usuario?._id);
  const aOtroPorCorreo =
    correo && normalizarCorreo(correo) !== normalizarCorreo(usuario?.correo ?? '');

  return aOtroPorId || aOtroPorCorreo ? 'Solo puedes matricularte a ti mismo' : null;
};

/**
 * Inscribe un estudiante en un curso.
 *
 * Antes no se comprobaba nada del contenido: se podía matricular a un
 * administrador en un curso inexistente y el sistema lo aceptaba. Los dos
 * identificadores tienen formato válido —de eso se encarga el validador de la
 * ruta— pero que un ObjectId esté bien escrito no quiere decir que exista.
 *
 * Y tampoco se comprobaba QUIÉN pedía qué: cualquier usuario autenticado podía
 * matricular a cualquier otro. Lo llamativo es que el código ya distinguía el
 * caso unas líneas más abajo, para decidir si lo registraba en auditoría.
 */
const inscribirEstudiante = async (req, res, next) => {
  try {
    const { cursoId, estudianteId, correo } = req.body;

    const curso = await Curso.findById(cursoId).select('_id nombre profesor estado cupoMaximo');

    // El curso no está: 404, porque el recurso al que apunta no existe.
    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'El curso no existe' });
    }

    // La autorización va ANTES de resolver a quién se matricula, y no es solo
    // orden: si fuera después, un estudiante podría distinguir "no hay ninguna
    // cuenta con ese correo" (404) de "esa cuenta no es de un estudiante"
    // (400) de un 201 — la misma enumeración de correos que se cerró en el
    // login, entrando por otra puerta. Aquí el 403 es idéntico exista ese
    // correo o no.
    const negado = motivoParaNegar({ usuario: req.usuario, curso, estudianteId, correo });
    if (negado) {
      return res.status(403).json({ ok: false, msg: negado });
    }

    // Sin destinatario, se matricula quien lo pide. Es lo que hace la interfaz
    // del estudiante, que no tiene por qué mandar su propio identificador.
    const estudiante =
      estudianteId || correo
        ? await resolverEstudiante({ estudianteId, correo })
        : await Usuario.findById(req.usuario?._id).select('rol nombre correo');

    // El estudiante sí existe pero no es un estudiante: 400, porque el dato
    // que manda el cliente está mal, no falta.
    if (!estudiante) {
      const msg = correo ? 'No hay ninguna cuenta con ese correo' : 'El estudiante no existe';
      return res.status(404).json({ ok: false, msg });
    }
    if (estudiante.rol !== 'estudiante') {
      return res.status(400).json({ ok: false, msg: 'Solo se puede matricular a un estudiante' });
    }

    // 409 y no 400: el dato que manda el cliente está bien, lo que pasa es que
    // el estado del recurso lo impide. Es la diferencia entre "esto está mal
    // escrito" y "esto ya no se puede".
    if (curso.estado !== 'abierto') {
      return res.status(409).json({
        ok: false,
        msg:
          curso.estado === 'archivado'
            ? 'Este curso está archivado y no admite matrículas.'
            : 'Este curso está cerrado a nuevas matrículas.',
        estado: curso.estado,
      });
    }

    // El cupo se comprueba contando, y contar no es atómico: entre el recuento
    // y la inserción cabe otra petición, así que dos matrículas simultáneas
    // sobre la última plaza pueden entrar las dos. Cerrarlo de verdad pide una
    // transacción, y este Mongo es de un solo nodo. Se deja dicho aquí y en el
    // README: pasarse de uno en una plaza es preferible a fingir que no pasa.
    if (curso.cupoMaximo) {
      const ocupadas = await Inscripcion.countDocuments({ curso: curso._id });
      if (ocupadas >= curso.cupoMaximo) {
        return res.status(409).json({
          ok: false,
          msg: `No quedan plazas en este curso (${ocupadas} de ${curso.cupoMaximo}).`,
          ocupadas,
          cupoMaximo: curso.cupoMaximo,
        });
      }
    }

    try {
      const inscripcion = await Inscripcion.create({
        curso: cursoId,
        estudiante: estudiante._id,
      });

      // Solo cuando matricula un tercero. Que alguien se apunte a sí mismo es
      // uso normal de la aplicación, no una acción administrativa: registrarlo
      // llenaría el historial de ruido y taparía lo que sí importa.
      if (String(req.usuario?._id) !== String(estudiante._id)) {
        registrar({
          actor: req.usuario,
          accion: 'matricula.creada',
          tipo: 'inscripcion',
          id: inscripcion._id,
          etiqueta: `${estudiante.nombre} en «${curso.nombre}»`,
          despues: { estudiante: estudiante.correo, curso: curso.nombre },
        });
      }

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
    // Poblada porque, si la baja la da un tercero, el registro necesita saber
    // a quién y de qué curso — y después del borrado ya no hay dónde mirarlo.
    const inscripcion = await Inscripcion.findById(req.params.id)
      .populate('estudiante', 'nombre correo')
      .populate('curso', 'nombre');
    if (!inscripcion) {
      return res.status(404).json({ ok: false, msg: 'Inscripción no encontrada' });
    }

    const rol = req.usuario?.rol;
    const idEstudiante = inscripcion.estudiante?._id ?? inscripcion.estudiante;
    const esSuya = String(idEstudiante) === String(req.usuario?._id);
    if (rol !== 'admin' && !(rol === 'estudiante' && esSuya)) {
      return res.status(403).json({ ok: false, msg: 'Esta matrícula no es tuya' });
    }

    await Inscripcion.findByIdAndDelete(inscripcion._id);

    // Igual que el alta: darse de baja uno mismo no es una acción
    // administrativa. Que te la den, sí.
    if (!esSuya) {
      registrar({
        actor: req.usuario,
        accion: 'matricula.borrada',
        tipo: 'inscripcion',
        id: inscripcion._id,
        etiqueta: `${inscripcion.estudiante?.nombre ?? '(cuenta borrada)'} en «${inscripcion.curso?.nombre ?? '(curso borrado)'}»`,
        antes: {
          estudiante: inscripcion.estudiante?.correo,
          curso: inscripcion.curso?.nombre,
        },
      });
    }

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
