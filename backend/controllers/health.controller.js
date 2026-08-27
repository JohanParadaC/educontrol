// controllers/health.controller.js
// ---------------------------------------------------------------------------
// Sondas de salud.
//
// Antes había una sola, `/api/health`, que devolvía `{ ok: true }` sin
// comprobar nada. Eso no es un health-check: es una constante. Con la base de
// datos caída seguía en verde, así que ni el orquestador ni el balanceador se
// enteraban de que la aplicación no podía atender a nadie.
//
// Ahora son dos preguntas distintas, que es como las hace Kubernetes y como
// deberían hacerse siempre:
//
//   /api/health/live   ¿el proceso está vivo?      → reiniciar si no
//   /api/health/ready  ¿puede atender peticiones?  → sacar del balanceo si no
//
// La diferencia importa: si la sonda de vida mirase Mongo, un corte de la base
// reiniciaría el contenedor una y otra vez sin arreglar nada — el proceso está
// perfectamente, lo que falla es otra cosa. La de disponibilidad sí la mira,
// porque sin base de datos no hay nada que servir.
//
// `/api/health` se queda como atajo de la de disponibilidad, que es lo que
// espera quien ya la usaba (el HEALTHCHECK de la imagen, el script de capturas
// y los tests de extremo a extremo).
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');

/** Los estados de `mongoose.connection.readyState`, en cristiano. */
const ESTADOS_MONGO = {
  0: 'desconectada',
  1: 'conectada',
  2: 'conectando',
  3: 'desconectando',
};

const estadoMongo = () => ESTADOS_MONGO[mongoose.connection.readyState] ?? 'desconocido';

/** Segundos que lleva el proceso en pie, redondeados. */
const enPie = () => Math.round(process.uptime());

/**
 * Se pone a `false` cuando empieza el apagado ordenado.
 *
 * Es lo primero que hace `apagar()`, antes de dejar de escuchar: así el
 * balanceador ve el 503 y deja de mandar tráfico MIENTRAS el proceso todavía
 * atiende lo que tiene entre manos. Al revés —cerrar el socket y que se entere
 * después— las peticiones de esos segundos mueren como errores de conexión.
 */
let disponible = true;

/** Lo llama el apagado ordenado. */
const marcarNoDisponible = () => {
  disponible = false;
};

/** Solo para los tests: deshace lo anterior. */
const marcarDisponible = () => {
  disponible = true;
};

/**
 * GET /api/health/live
 *
 * Que esto conteste ya significa que el proceso está vivo y que el bucle de
 * eventos responde. No mira nada más a propósito.
 */
const vivo = (_req, res) => {
  res.status(200).json({ ok: true, status: 'live', uptime: enPie() });
};

/**
 * GET /api/health/ready — y GET /api/health, que es lo mismo.
 *
 * 503 y no 500 cuando la base no está lista: no es un error de la petición ni
 * un fallo del código, es que el servicio no está disponible todavía. Un
 * balanceador entiende el 503 y deja de mandar tráfico; con un 200 seguiría
 * mandándolo a un proceso que solo sabe devolver errores.
 */
const listo = (_req, res) => {
  const mongo = estadoMongo();
  const puedeServir = disponible && mongoose.connection.readyState === 1;

  res.status(puedeServir ? 200 : 503).json({
    ok: puedeServir,
    status: puedeServir ? 'up' : 'degraded',
    mongo,
    uptime: enPie(),
  });
};

module.exports = { vivo, listo, estadoMongo, marcarNoDisponible, marcarDisponible };
