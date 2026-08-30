// models/Auditoria.js
// ---------------------------------------------------------------------------
// Registro de acciones administrativas.
//
// Hasta ahora, si un curso desaparecía o alguien pasaba a profesor, no había
// forma de saber quién lo hizo ni qué había antes. Los datos de la aplicación
// cuentan el estado actual y nada más: el "quién y cuándo" o se guarda en el
// momento o se pierde.
//
// Dos decisiones que no son obvias:
//
// 1. `etiqueta` guarda el nombre del recurso TAL Y COMO ERA al registrar la
//    acción, y por eso no es un `populate`. La mitad de lo que se audita son
//    borrados: si la fila solo llevara el id, el registro de "curso borrado"
//    apuntaría a la nada justo cuando más falta hace leerlo.
//
// 2. `antes` y `despues` son `Mixed` a propósito. Cada acción compara cosas
//    distintas —un rol es una cadena, un curso son tres campos— y forzar un
//    esquema común obligaría a inventar uno que no cuadra con ninguna.
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');

/** Las acciones que se registran. Cerrado a propósito: si no está, no se audita. */
const ACCIONES = [
  'rol.cambiado',
  'usuario.correo',
  'usuario.borrado',
  'curso.creado',
  'curso.editado',
  'curso.borrado',
  'matricula.creada',
  'matricula.borrada',
];

const AuditoriaSchema = new mongoose.Schema(
  {
    // Quién. Se conserva también su nombre, por lo mismo que la etiqueta del
    // recurso: una cuenta borrada no puede dejar el registro sin autor.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },
    actorNombre: { type: String, required: true },
    actorRol: { type: String, required: true },

    accion: {
      type: String,
      required: true,
      enum: { values: ACCIONES, message: 'Acción de auditoría desconocida' },
      index: true,
    },

    // Sobre qué.
    recurso: {
      tipo: { type: String, required: true }, // 'curso' | 'usuario' | 'inscripcion'
      id: { type: mongoose.Schema.Types.ObjectId },
      etiqueta: { type: String },
    },

    antes: { type: mongoose.Schema.Types.Mixed },
    despues: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// El listado se lee siempre por fecha descendente, con o sin filtro.
AuditoriaSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Auditoria', AuditoriaSchema);
module.exports.ACCIONES = ACCIONES;
