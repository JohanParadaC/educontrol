// __tests__/server.puerto.spec.js
// ---------------------------------------------------------------------------
// Arrancar con el puerto ocupado.
//
// Es el fallo más común de todos —otra instancia abierta, o el contenedor del
// compose publicando el mismo 3000— y salía como:
//
//     TypeError: Cannot read properties of null (reading 'port')
//
// que no nombra el puerto, ni el problema, ni qué hacer. En Windows `listen()`
// llama igualmente al callback de `listening` y deja `address()` en `null`; el
// `'error'` llega después, así que resolver en el callback daba un servidor
// que no escuchaba.
// ---------------------------------------------------------------------------
const express = require('express');

const { arrancar } = require('../server');

/** Una aplicación de atrezo: no hace falta la de verdad para ocupar un puerto. */
const atrezo = () => express();

/** Levanta algo en un puerto libre y devuelve el puerto y cómo cerrarlo. */
function ocuparUnPuerto() {
  return new Promise(resolver => {
    const s = atrezo().listen(0, () =>
      resolver({ puerto: s.address().port, cerrar: () => new Promise(r => s.close(r)) })
    );
  });
}

describe('arrancar con el puerto ocupado', () => {
  it('dice qué puerto es y qué hacer, en vez de reventar leyendo null', async () => {
    const ocupado = await ocuparUnPuerto();

    try {
      await expect(arrancar({ puerto: ocupado.puerto, aplicacion: atrezo() })).rejects.toThrow(
        new RegExp(`El puerto ${ocupado.puerto} ya está en uso`)
      );
    } finally {
      await ocupado.cerrar();
    }
  });

  it('el error lleva el código de red, para poder distinguirlo', async () => {
    const ocupado = await ocuparUnPuerto();

    try {
      // Con `code` puesto, el punto de entrada imprime solo el mensaje: la
      // traza de un fallo de configuración esconde lo único que importa entre
      // líneas de node_modules.
      await expect(
        arrancar({ puerto: ocupado.puerto, aplicacion: atrezo() })
      ).rejects.toMatchObject({ code: 'EADDRINUSE' });
    } finally {
      await ocupado.cerrar();
    }
  });

  it('con el puerto libre arranca y dice en cuál está', async () => {
    const servidor = await arrancar({ puerto: 0, aplicacion: atrezo() });

    try {
      // `address()` no es null: está escuchando de verdad, que es justo lo que
      // el arreglo comprueba antes de dar el arranque por bueno.
      expect(servidor.address()).not.toBeNull();
      expect(servidor.address().port).toBeGreaterThan(0);
    } finally {
      await new Promise(r => servidor.close(r));
    }
  });
});
