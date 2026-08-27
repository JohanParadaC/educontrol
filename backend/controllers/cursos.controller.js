const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario'); // CAMBIO: lo usamos para validar el profesor
const Inscripcion = require('../models/Inscripcion');
const { leerPaginacion, metadatos } = require('../utils/paginacion');
const { escaparRegex } = require('../utils/regex');
const { generarCsv, cabeceraDescarga } = require('../utils/csv');
const { registrar, instantaneaCurso } = require('../utils/auditoria');
const { puedeGestionarCurso } = require('../utils/propiedad');

// La regla de propiedad vive en utils/propiedad.js: la necesitan también las
// inscripciones, y copiarla sería garantizar que dentro de un mes solo se
// cumple en uno de los dos sitios.
const puedeGestionar = puedeGestionarCurso;

// Crear un curso
const crearCurso = async (req, res, next) => {
  try {
    // CAMBIO: ahora leemos también "profesor" del body
    const { nombre, descripcion, profesor, cupoMaximo, estado } = req.body;

    // CAMBIO: resolver profesorId correctamente
    // - Si viene en el body, usarlo.
    // - Si NO viene y el que crea es profesor, usar req.uid (él mismo).
    // - Si NO viene y el que crea es admin, devolver 400 (requerido).
    let profesorId = profesor;
    if (!profesorId) {
      if (req.usuario?.rol === 'profesor') {
        profesorId = req.uid;
      } else {
        return res.status(400).json({ ok: false, msg: 'El campo "profesor" es requerido' });
      }
    }

    // CAMBIO: validar que exista y sea rol "profesor"
    const profDoc = await Usuario.findById(profesorId);
    if (!profDoc || profDoc.rol !== 'profesor') {
      return res.status(400).json({ ok: false, msg: 'Profesor inválido' });
    }

    // Crear curso con el profesor resuelto. `cupoMaximo` y `estado` solo se
    // mandan si vienen: si no, manda el esquema (sin cupo y abierto).
    const curso = await Curso.create({
      nombre,
      descripcion,
      profesor: profesorId,
      ...(cupoMaximo !== undefined && cupoMaximo !== null ? { cupoMaximo } : {}),
      ...(estado !== undefined ? { estado } : {}),
    });

    registrar({
      actor: req.usuario,
      accion: 'curso.creado',
      tipo: 'curso',
      id: curso._id,
      etiqueta: curso.nombre,
      despues: instantaneaCurso(curso),
    });

    // CAMBIO: devolver populado para que el front lo vea al instante
    await curso.populate('profesor', 'nombre correo');
    return res.status(201).json({ ok: true, curso });
  } catch (err) {
    next(err);
  }
};

/**
 * Listado de cursos, paginado y con filtros de servidor.
 *
 *   ?profesor=me   → los que imparte quien pregunta
 *   ?profesor=<id> → los de ese profesor
 *   ?buscar=texto  → busca en nombre y descripción
 *
 * Los dos filtros existían antes en el navegador: "mis clases" se descargaba
 * hasta 100 cursos y comparaba identificadores, y la búsqueda del catálogo
 * filtraba sobre esos mismos 100. Con 101 cursos, las dos mienten sin decirlo.
 */
const obtenerCursos = async (req, res, next) => {
  try {
    const { pagina, limite, saltar } = leerPaginacion(req.query);

    const filtro = {};

    if (req.query.profesor) {
      filtro.profesor = req.query.profesor === 'me' ? req.usuario._id : req.query.profesor;
    }

    // El texto del usuario es literal, no un patrón: se escapa antes de
    // convertirlo en regex.
    // Un curso archivado no desaparece: deja de ofrecerse. El estudiante no lo
    // ve en el catálogo; administración y profesorado sí, que archivar no es
    // borrar. El `$ne` cubre además a los cursos anteriores al campo, que no
    // lo tienen escrito en la base.
    if (req.usuario?.rol === 'estudiante') {
      filtro.estado = { $ne: 'archivado' };
    }

    const buscar = String(req.query.buscar ?? '').trim();
    if (buscar) {
      const patron = new RegExp(escaparRegex(buscar), 'i');
      filtro.$or = [{ nombre: patron }, { descripcion: patron }];
    }

    const [cursos, total] = await Promise.all([
      Curso.find(filtro)
        .populate('profesor', 'nombre correo')
        .sort({ nombre: 1 })
        .skip(saltar)
        .limit(limite),
      Curso.countDocuments(filtro),
    ]);

    return res.json({ ok: true, cursos, ...metadatos({ total, pagina, limite }) });
  } catch (err) {
    next(err);
  }
};

/**
 * Un curso por ID, con lo que hace falta para pintar su ficha.
 *
 * Devuelve siempre `matriculados` —cuántos hay es un dato del curso, como su
 * título— y `estudiantes` SOLO si quien pregunta gestiona el curso: su
 * profesor o un administrador. Un estudiante puede saber que en su clase son
 * treinta y no quiénes son los otros veintinueve; es la misma regla que filtra
 * `GET /api/inscripciones`.
 *
 * La clave se omite en vez de mandarse vacía: `[]` significaría "no hay
 * ninguno", que es otra cosa, y la ficha decide con esa diferencia si enseña
 * la lista o no.
 */
const obtenerCursoPorId = async (req, res, next) => {
  try {
    const curso = await Curso.findById(req.params.id).populate('profesor', 'nombre correo');
    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'Curso no encontrado' });
    }

    const matriculados = await Inscripcion.countDocuments({ curso: curso._id });
    const respuesta = { ok: true, curso, matriculados };

    if (puedeGestionar(curso, req.usuario)) {
      const inscripciones = await Inscripcion.find({ curso: curso._id }).populate(
        'estudiante',
        'nombre correo'
      );
      respuesta.estudiantes = inscripciones
        .map(i => i.estudiante)
        .filter(Boolean)
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    }

    return res.json(respuesta);
  } catch (err) {
    next(err);
  }
};

/**
 * La lista de matriculados en CSV.
 *
 * GET /api/cursos/:id/estudiantes.csv
 *
 * Misma puerta que la lista de la ficha —su profesor o un administrador—, pero
 * aquí el 403 es explícito en vez de una clave que no viaja: quien pide este
 * recurso ya sabe que el curso existe, así que callar no protege nada y
 * confunde.
 */
const exportarEstudiantesCsv = async (req, res, next) => {
  try {
    const curso = await Curso.findById(req.params.id).select('nombre profesor');
    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'Curso no encontrado' });
    }
    if (!puedeGestionar(curso, req.usuario)) {
      return res.status(403).json({ ok: false, msg: 'Este curso no es tuyo' });
    }

    const inscripciones = await Inscripcion.find({ curso: curso._id }).populate(
      'estudiante',
      'nombre correo'
    );

    const filas = inscripciones
      .filter(i => i.estudiante)
      .map(i => [
        i.estudiante.nombre,
        i.estudiante.correo,
        // ISO y no formato local: es lo único que cualquier hoja de cálculo y
        // cualquier script leen igual. `fecha` es el respaldo de los
        // documentos anteriores a `timestamps`.
        new Date(i.createdAt ?? i.fecha).toISOString().slice(0, 10),
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'es'));

    const csv = generarCsv(['Nombre', 'Correo', 'Matriculado el'], filas);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', cabeceraDescarga(`${curso.nombre} - estudiantes.csv`));
    // Sin esto un proxy podría servir la lista de un curso a quien pida la de
    // otro: la respuesta depende de quién la pide.
    res.setHeader('Cache-Control', 'no-store');
    return res.send(csv);
  } catch (err) {
    next(err);
  }
};

// Actualizar curso
const actualizarCurso = async (req, res, next) => {
  try {
    // Primero el curso, para poder mirar de quién es antes de escribir nada.
    const existente = await Curso.findById(req.params.id);
    if (!existente) {
      return res.status(404).json({ ok: false, msg: 'Curso no encontrado' });
    }
    if (!puedeGestionar(existente, req.usuario)) {
      return res.status(403).json({ ok: false, msg: 'Este curso no es tuyo' });
    }

    // CAMBIO: aceptar profesor en el PUT
    const { nombre, descripcion, profesor, cupoMaximo, estado } = req.body;

    // Construimos el update SOLO con los campos enviados
    const update = {};
    const quitar = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (descripcion !== undefined) update.descripcion = descripcion;
    if (estado !== undefined) update.estado = estado;

    // Mandar el cupo a null o a vacío es quitar el límite, y quitarlo es
    // borrar el campo: dejar un `null` guardado obligaría a comprobar dos
    // formas de "sin cupo" en cada sitio que lo mire.
    if (cupoMaximo !== undefined) {
      if (cupoMaximo === null || cupoMaximo === '') quitar.cupoMaximo = 1;
      else update.cupoMaximo = cupoMaximo;
    }

    // CAMBIO: si viene "profesor", validarlo y aplicarlo
    if (profesor !== undefined && profesor !== null && profesor !== '') {
      const profDoc = await Usuario.findById(profesor);
      if (!profDoc || profDoc.rol !== 'profesor') {
        return res.status(400).json({ ok: false, msg: 'Profesor inválido' });
      }
      update.profesor = profesor;
    }

    // Cómo estaba antes, para el registro. Se toma aquí, con el documento ya
    // leído y todavía sin tocar.
    const antes = instantaneaCurso(existente);

    const operacion = Object.keys(quitar).length
      ? { $set: update, $unset: quitar }
      : { $set: update };

    const curso = await Curso.findByIdAndUpdate(req.params.id, operacion, {
      new: true,
      runValidators: true,
    }).populate('profesor', 'nombre correo');

    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'Curso no encontrado' });
    }

    registrar({
      actor: req.usuario,
      accion: 'curso.editado',
      tipo: 'curso',
      id: curso._id,
      etiqueta: curso.nombre,
      antes,
      despues: instantaneaCurso(curso),
    });

    return res.json({ ok: true, curso });
  } catch (err) {
    next(err);
  }
};

// Borrar curso, con sus inscripciones
const borrarCurso = async (req, res, next) => {
  try {
    const curso = await Curso.findById(req.params.id);
    if (!curso) {
      return res.status(404).json({ ok: false, msg: 'Curso no encontrado' });
    }
    if (!puedeGestionar(curso, req.usuario)) {
      return res.status(403).json({ ok: false, msg: 'Este curso no es tuyo' });
    }

    // Las inscripciones primero, y luego el curso.
    //
    // Sin cascada quedaban vivas apuntando a un curso que ya no existe: basura
    // invisible que el profesor sigue viendo como "alumno fantasma". No hay
    // transacción (Mongo de un solo nodo), así que el orden importa: si algo
    // se corta por la mitad, es preferible un curso sin alumnos — se ve y se
    // arregla matriculando otra vez — que filas huérfanas que nadie encuentra.
    const { deletedCount = 0 } = await Inscripcion.deleteMany({ curso: curso._id });
    await Curso.findByIdAndDelete(curso._id);

    // La etiqueta se guarda porque el curso ya no está: sin ella, el registro
    // de "curso borrado" apuntaría a un id que no lleva a ningún sitio.
    registrar({
      actor: req.usuario,
      accion: 'curso.borrado',
      tipo: 'curso',
      id: curso._id,
      etiqueta: curso.nombre,
      antes: { ...instantaneaCurso(curso), inscripcionesEliminadas: deletedCount },
    });

    return res.json({
      ok: true,
      msg: 'Curso eliminado',
      inscripcionesEliminadas: deletedCount,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crearCurso,
  obtenerCursos,
  obtenerCursoPorId,
  exportarEstudiantesCsv,
  actualizarCurso,
  borrarCurso,
};
