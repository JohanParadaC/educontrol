// src/app/data/paginacion.ts
// ---------------------------------------------------------------------------
// Tipos y normalización de las respuestas paginadas del backend.
// Compartido por los servicios de usuarios y cursos.
// ---------------------------------------------------------------------------

/** Tamaño de página por defecto y tope que aplica el backend. */
export const LIMITE_PAGINA = 20;
export const LIMITE_MAXIMO_PAGINA = 100;

/** Una página de resultados con lo que necesita un paginador. */
export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
}

/**
 * Normaliza la respuesta del backend a una Pagina.
 * Tolera que llegue un array pelado (sin metadatos) por si algún endpoint
 * todavía no pagina.
 */
export function aPagina<T>(
  respuesta: any,
  clave: string,
  pagina: number,
  limite: number
): Pagina<T> {
  const items: T[] = Array.isArray(respuesta) ? respuesta : (respuesta?.[clave] ?? []);
  return {
    items,
    total: respuesta?.total ?? items.length,
    pagina: respuesta?.pagina ?? pagina,
    limite: respuesta?.limite ?? limite,
    paginas: respuesta?.paginas ?? 1,
  };
}
