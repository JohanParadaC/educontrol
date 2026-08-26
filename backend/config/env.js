// config/env.js
// ---------------------------------------------------------------------------
// Comprobación de variables de entorno al arrancar.
//
// Sin esto, un clone sin .env arranca "bien" y luego devuelve 500 en cada login
// (jwt.sign lanza si el secreto es undefined). Es peor que fallar: el síntoma
// aparece lejos de la causa. Aquí se decide una vez, al principio:
//   - en producción faltar un secreto es fatal → salimos con un mensaje claro,
//   - en desarrollo rellenamos con valores obvios y avisamos.
// ---------------------------------------------------------------------------

const DEV_JWT_SECRET = 'dev-only-no-usar-en-produccion';
const DEV_PROFESOR_CLAVE = 'profesor-dev';

function verificarEntorno() {
  const esProduccion = process.env.NODE_ENV === 'production';

  if (!process.env.JWT_SECRET) {
    if (esProduccion) {
      console.error('❌ Falta JWT_SECRET. Configúralo antes de arrancar en producción.');
      process.exit(1);
      // `return` explícito: sin él, la asignación de abajo dependería de que
      // process.exit mate el proceso de inmediato para no colar el secreto de
      // desarrollo en producción. Eso es apoyarse en un efecto colateral.
      return;
    }
    process.env.JWT_SECRET = DEV_JWT_SECRET;
    console.warn('⚠️  JWT_SECRET no configurado: usando un secreto de desarrollo.');
  }

  if (!process.env.PROFESOR_CLAVE) {
    if (esProduccion) {
      console.warn(
        '⚠️  PROFESOR_CLAVE no configurada: nadie podrá ascender a profesor sin un admin.'
      );
    } else {
      process.env.PROFESOR_CLAVE = DEV_PROFESOR_CLAVE;
      console.warn(
        `⚠️  PROFESOR_CLAVE no configurada: usando "${DEV_PROFESOR_CLAVE}" en desarrollo.`
      );
    }
  }
}

module.exports = { verificarEntorno };
