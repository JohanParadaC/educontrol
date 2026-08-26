// utils/regex.js
// ---------------------------------------------------------------------------
// Texto que escribe un usuario y acaba dentro de una expresión regular.
//
// Sin escapar, buscar "c++" o "(" hace que Mongo reciba una regex inválida y
// devuelva un 500; y patrones como "(a+)+$" se pueden colgar buscando (ReDoS).
// Lo que el usuario escribe es texto literal, no un patrón.
// ---------------------------------------------------------------------------

const escaparRegex = (texto = '') => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escaparRegex };
