// __tests__/health.spec.js
// ---------------------------------------------------------------------------
// Las sondas de salud.
//
// La de antes devolvía `{ ok: true }` sin comprobar nada: con Mongo caído
// seguía en verde, así que ni el orquestador ni el balanceador se enteraban de
// que la aplicación no podía atender a nadie. Aquí se fija que ahora sí.
// ---------------------------------------------------------------------------
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { marcarNoDisponible, marcarDisponible } = require('../controllers/health.controller');

/**
 * Finge el estado de la conexión sin tocarla de verdad.
 *
 * Con `defineProperty` y no con `jest.spyOn`: `readyState` es un getter del
 * prototipo de la conexión y no es configurable, así que espiarlo falla. Lo
 * que sí se puede es ponerle una propiedad propia delante y borrarla después,
 * que devuelve el getter original.
 */
function fingirMongo(readyState) {
  Object.defineProperty(mongoose.connection, 'readyState', {
    value: readyState,
    configurable: true,
  });
}

function dejarDeFingir() {
  delete mongoose.connection.readyState;
}

describe('Sondas de salud', () => {
  afterEach(() => {
    dejarDeFingir();
    marcarDisponible();
  });

  describe('GET /api/health/live — ¿el proceso está vivo?', () => {
    it('responde 200 con la conexión en pie', async () => {
      const { body } = await request(app).get('/api/health/live').expect(200);
      expect(body).toEqual(expect.objectContaining({ ok: true, status: 'live' }));
      expect(typeof body.uptime).toBe('number');
    });

    it('sigue en 200 aunque Mongo esté caído: el proceso está bien', async () => {
      fingirMongo(0);

      // Si la sonda de vida mirase la base, un corte de Mongo reiniciaría el
      // contenedor una y otra vez sin arreglar nada.
      const { body } = await request(app).get('/api/health/live').expect(200);
      expect(body.ok).toBe(true);
    });

    it('tampoco le afecta el apagado ordenado', async () => {
      marcarNoDisponible();
      await request(app).get('/api/health/live').expect(200);
    });
  });

  describe('GET /api/health/ready — ¿puede atender?', () => {
    it('200 con la base conectada', async () => {
      const { body } = await request(app).get('/api/health/ready').expect(200);
      expect(body).toEqual(expect.objectContaining({ ok: true, status: 'up', mongo: 'conectada' }));
    });

    it('503 con la base desconectada, y lo dice', async () => {
      fingirMongo(0);

      const { body } = await request(app).get('/api/health/ready').expect(503);
      expect(body.ok).toBe(false);
      expect(body.status).toBe('degraded');
      expect(body.mongo).toBe('desconectada');
    });

    it('503 también mientras se está conectando', async () => {
      fingirMongo(2);

      const { body } = await request(app).get('/api/health/ready').expect(503);
      expect(body.mongo).toBe('conectando');
    });

    it('503 durante el apagado ordenado, con la base todavía conectada', async () => {
      marcarNoDisponible();

      const { body } = await request(app).get('/api/health/ready').expect(503);
      // La base sigue bien: lo que pasa es que estamos cerrando.
      expect(body.mongo).toBe('conectada');
      expect(body.ok).toBe(false);
    });
  });

  describe('GET /api/health — el atajo de siempre', () => {
    it('responde igual que /ready: 200 y ok:true', async () => {
      const { body } = await request(app).get('/api/health').expect(200);
      expect(body).toEqual(expect.objectContaining({ ok: true, status: 'up' }));
    });

    it('y 503 cuando la de disponibilidad diría 503', async () => {
      fingirMongo(0);
      await request(app).get('/api/health').expect(503);
    });

    it('no lo frena el limitador de peticiones', async () => {
      // Se monta antes del freno a propósito: el orquestador la llama cada
      // pocos segundos y un 429 en la sonda reiniciaría el contenedor.
      for (let i = 0; i < 20; i++) {
        await request(app).get('/api/health/live').expect(200);
      }
    });
  });
});
