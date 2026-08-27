// utils/csv.js
// ---------------------------------------------------------------------------
// Generación de CSV, con las tres cosas que suelen faltar y que se ven en
// cuanto alguien abre el fichero de verdad:
//
// 1. **Escapado RFC 4180.** Un alumno que se llame «Ruiz, Ana» parte la fila en
//    dos columnas si no se entrecomilla, y las comillas de dentro hay que
//    duplicarlas o el campo se cierra antes de tiempo.
// 2. **Saltos CRLF.** Es lo que dice el RFC y lo que espera Excel.
// 3. **BOM UTF-8.** Sin él, Excel abre el fichero en la codificación del
//    sistema y «Nuria Fernández» sale como «Nuria FernÃ¡ndez». El BOM no lo
//    necesita ningún lector moderno, pero tampoco le estorba.
//
// Lo que NO se hace: cambiar la coma por punto y coma. Un Excel en español
// espera `;` y pondría todo en una columna, pero eso rompería a cualquier otro
// lector. El separador estándar es la coma; quien use Excel en español lo
// resuelve en el asistente de importación.
// ---------------------------------------------------------------------------

const BOM = '\uFEFF';
const SALTO = '\r\n';

/** ¿Este valor necesita comillas? Coma, comilla, o cualquier salto de línea. */
const necesitaComillas = texto => /[",\r\n]/.test(texto);

/** Un campo, listo para escribir. */
function campo(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  return necesitaComillas(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Arma el CSV completo, con BOM.
 *
 * @param {string[]} cabeceras
 * @param {Array<Array<*>>} filas
 */
function generarCsv(cabeceras, filas) {
  const lineas = [cabeceras, ...filas].map(fila => fila.map(campo).join(','));
  return BOM + lineas.join(SALTO) + SALTO;
}

/**
 * Valor de `Content-Disposition` con el nombre real del fichero.
 *
 * Van los dos parámetros a propósito: `filename` en ASCII para los clientes
 * antiguos —una cabecera HTTP no puede llevar tildes— y `filename*` con el
 * nombre de verdad codificado (RFC 5987), que es el que usan los navegadores.
 */
function cabeceraDescarga(nombre) {
  const seguro =
    nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // fuera tildes
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'export';

  return `attachment; filename="${seguro}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

module.exports = { generarCsv, cabeceraDescarga, campo, BOM };
