// utils/paginacion.js
// ---------------------------------------------------------------------------
// Paginación para los listados.
//
// Un endpoint que devuelve la colección entera funciona con los 6 usuarios del
// seed y se cae con 500: cada petición arrastra toda la tabla a memoria, la
// serializa y la manda por la red.
//
// El tope es lo importante: `limit` lo elige el cliente, así que sin un máximo
// duro `?limit=999999` reintroduce el mismo problema desde fuera.
// ---------------------------------------------------------------------------

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 100;

/**
 * Lee `page` y `limit` de la query y los deja en un rango sano.
 * Valores ausentes, negativos o no numéricos caen a los valores por defecto.
 */
function leerPaginacion(query = {}) {
  const pagina = Math.max(1, Number.parseInt(query.page, 10) || 1);

  const pedido = Number.parseInt(query.limit, 10);
  const limite =
    Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, LIMITE_MAXIMO) : LIMITE_POR_DEFECTO;

  return { pagina, limite, saltar: (pagina - 1) * limite };
}

/** Metadatos que acompañan a la lista, para que el cliente pinte su paginador. */
function metadatos({ total, pagina, limite }) {
  return {
    total,
    pagina,
    limite,
    paginas: Math.max(1, Math.ceil(total / limite)),
  };
}

module.exports = { leerPaginacion, metadatos, LIMITE_POR_DEFECTO, LIMITE_MAXIMO };
