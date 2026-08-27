// config/migraciones.js
// ---------------------------------------------------------------------------
// Migraciones de datos, idempotentes, que se ejecutan al arrancar.
//
// No hay framework de migraciones ni hace falta: son puestas al día de campos
// nuevos sobre documentos viejos, y cada una se escribe para poder correr mil
// veces sin efecto. Lo que NO se hace es confiar solo en el `default` del
// esquema: Mongoose lo aplica al hidratar un documento, así que en memoria se
// ve bien, pero en la base el campo sigue sin existir y cualquier consulta que
// filtre por él —`{ estado: 'abierto' }`— deja fuera a los cursos de antes.
// ---------------------------------------------------------------------------
const Curso = require('../models/Curso');

/** Los cursos anteriores al campo `estado` quedan abiertos, que es lo que eran. */
async function migrarEstadoDeCursos() {
  const { modifiedCount = 0 } = await Curso.updateMany(
    { estado: { $exists: false } },
    { $set: { estado: 'abierto' } }
  );
  return modifiedCount;
}

/**
 * Corre todas las migraciones. Nunca tumba el arranque: si una falla, se avisa
 * y el servidor sigue levantando. Una migración rota no debe dejar la
 * aplicación sin arrancar.
 */
async function migrar() {
  try {
    const cursos = await migrarEstadoDeCursos();
    if (cursos > 0) {
      console.log(`🔧 Migración: ${cursos} curso(s) sin estado quedan como "abierto".`);
    }
  } catch (err) {
    console.error('⚠️  Falló alguna migración:', err.message);
  }
}

module.exports = { migrar, migrarEstadoDeCursos };
