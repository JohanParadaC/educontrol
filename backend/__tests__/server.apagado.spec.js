// __tests__/server.apagado.spec.js
// ---------------------------------------------------------------------------
// Apagado ordenado.
//
// El criterio es "parar el contenedor no corta peticiones en curso", y eso no
// se comprueba leyendo el código: hay que tener una petición a medias cuando
// llega la señal y ver que termina bien.
//
// Va todo en un solo `it` a propósito. `apagar()` desconecta Mongo y solo se
// ejecuta una vez —un segundo SIGTERM no debe empezar otro apagado—, así que
// partirlo en varios tests obligaría a arrancar y apagar el proceso entero en
// cada uno para comprobar cuatro cosas que ocurren en la misma secuencia.
// ---------------------------------------------------------------------------
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../app');
const { arrancar, apagar } = require('../server');
const { connectDB } = require('../config/db');

/** Se resuelve cuando la petición lenta llega al manejador. */
let enMarcha;
/** El test la resuelve cuando quiere que la petición lenta termine. */
let soltar;

/**
 * Una aplicación de atrezo con una sola ruta, que tarda lo que el test quiera.
 *
 * No se le añade a la de verdad por dos razones: no forma parte de la API —el
 * test de contrato de OpenAPI la vería— y, sobre todo, no funcionaría: app.js
 * monta el fallback de la SPA al cargarse, y se queda con cualquier ruta
 * registrada después.
 */
function aplicacionLenta() {
  const lenta = express();
  lenta.get('/__lenta', async (_req, res) => {
    enMarcha.resolver();
    await soltar.promesa;
    res.json({ ok: true, terminada: true });
  });
  return lenta;
}

const señal = () => {
  let resolver;
  const promesa = new Promise(r => (resolver = r));
  return { promesa, resolver };
};

describe('Apagado ordenado', () => {
  it('espera a la petición en curso, deja de estar disponible y suelta Mongo', async () => {
    // Corte corto: si el drenaje se atascara, el test falla en dos segundos en
    // vez de tardar los diez de producción en decirlo.
    process.env.SHUTDOWN_TIMEOUT_MS = '2000';

    enMarcha = señal();
    soltar = señal();

    const servidor = await arrancar({ puerto: 0, aplicacion: aplicacionLenta() });
    const puerto = servidor.address().port;
    const url = `http://127.0.0.1:${puerto}`;

    // 1) Una petición que se queda a medias. Con `fetch` y no con supertest:
    //    aquí interesa una conexión de verdad contra el puerto, que es lo que
    //    el apagado tiene que respetar.
    const respuestaLenta = fetch(`${url}/__lenta`);
    await enMarcha.promesa;

    // 2) Llega la señal. No se espera todavía: el apagado no puede terminar
    //    mientras la petición siga viva, y justo eso es lo que se comprueba.
    const apagado = apagar('SIGTERM');

    // 3) Lo primero que hace es dejar de decir que está disponible, ANTES de
    //    cerrar el socket: así el balanceador deja de mandar tráfico mientras
    //    el proceso todavía termina lo que tiene entre manos.
    const sonda = await request(app).get('/api/health/ready');
    expect(sonda.status).toBe(503);
    expect(sonda.body.mongo).toBe('conectada'); // la base sigue bien

    // Y la sonda de vida sigue diciendo que sí: el proceso está perfectamente.
    await request(app).get('/api/health/live').expect(200);

    // 4) Se suelta la petición: tiene que terminar bien, no cortada.
    soltar.resolver();
    const terminada = await respuestaLenta;
    expect(terminada.status).toBe(200);
    expect(await terminada.json()).toEqual({ ok: true, terminada: true });

    await apagado;

    // 5) Ya no escucha, y la base está suelta.
    expect(mongoose.connection.readyState).toBe(0);
    await expect(fetch(`${url}/__lenta`)).rejects.toThrow();

    // 6) Un segundo SIGTERM no vuelve a empezar: es idempotente.
    await expect(apagar('SIGTERM')).resolves.toBeUndefined();

    // La suite comparte la conexión (jest.setup limpia las colecciones entre
    // casos), así que hay que devolverla como estaba.
    await connectDB(process.env.MONGO_URI);
    expect(mongoose.connection.readyState).toBe(1);
  }, 20_000);
});
