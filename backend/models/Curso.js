const mongoose = require('mongoose');

const CursoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      // Un título es una línea. Sin tope, el primer copia y pega descuadra la
      // tabla de administración y no hay forma de arreglarlo desde la interfaz.
      maxlength: [120, 'El nombre no puede pasar de 120 caracteres'],
    },
    descripcion: {
      type: String,
      trim: true,
      // El panel de administración tenía un DESC_LARGA = 200 para "compactar
      // acciones" cuando la descripción se desbordaba: un parche visual a un
      // dato que nadie había acotado. Se acota aquí, que es donde toca.
      maxlength: [500, 'La descripción no puede pasar de 500 caracteres'],
    },
    profesor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      // Es la clave de "mis clases" (?profesor=me) y del recuento de cursos al
      // borrar a un profesor.
      index: true,
    },

    /**
     * Plazas. Opcional: sin cupo, no hay límite.
     *
     * `undefined` y no 0 para "sin límite": un 0 significaría "cero plazas", y
     * la diferencia entre "no lo hemos decidido" y "no cabe nadie" importa.
     */
    cupoMaximo: {
      type: Number,
      min: [1, 'El cupo tiene que ser de al menos una plaza'],
      validate: {
        validator: v => v === undefined || v === null || Number.isInteger(v),
        message: 'El cupo tiene que ser un número entero',
      },
    },

    /**
     * En qué punto de su vida está el curso:
     *
     *   abierto    admite matrículas.
     *   cerrado    ya no admite, pero sigue visible y con sus alumnos dentro.
     *   archivado  desaparece del catálogo del estudiante. Administración lo
     *              sigue viendo, etiquetado: archivar no es borrar.
     *
     * Indexado porque el catálogo filtra por él en cada carga.
     */
    estado: {
      type: String,
      enum: {
        values: ['abierto', 'cerrado', 'archivado'],
        message: 'El estado tiene que ser abierto, cerrado o archivado',
      },
      default: 'abierto',
      index: true,
    },
  },
  { timestamps: true }
);

// Nota sobre la búsqueda: `?buscar=` usa una expresión regular sin anclar,
// porque un buscador de catálogo tiene que encontrar "Angular" escribiendo
// "ngul". Un índice de texto de Mongo no sirve para eso —solo entiende
// palabras completas y su raíz— y el planificador no lo usaría nunca. Se deja
// sin índice a propósito: uno que no se usa cuesta escrituras y disco a cambio
// de nada.

module.exports = mongoose.model('Curso', CursoSchema);
