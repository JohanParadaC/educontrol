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
