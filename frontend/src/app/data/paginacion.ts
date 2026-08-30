// src/app/data/paginacion.ts
// ---------------------------------------------------------------------------
// Tipos y normalización de las respuestas paginadas del backend.
// Compartido por los servicios de usuarios y cursos.
// ---------------------------------------------------------------------------

/** Tamaño de página por defecto y tope que aplica el backend. */
export const LIMITE_PAGINA = 20;
export const LIMITE_MAXIMO_PAGINA = 100;

/**
 * Una respuesta JSON del backend antes de saber qué trae dentro.
 *
 * Es `unknown` por valor y no `any`: leer una clave sigue siendo posible, pero
 * hay que decir de qué tipo se espera, que es justo la comprobación que un
 * `any` se saltaba.
 */
export type Sobre = Record<string, unknown>;

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
  respuesta: Sobre | T[] | null | undefined,
  clave: string,
  pagina: number,
  limite: number
): Pagina<T> {
  const sobre = Array.isArray(respuesta) ? null : respuesta;
  const items: T[] = Array.isArray(respuesta) ? respuesta : ((sobre?.[clave] as T[]) ?? []);
  return {
    items,
    total: (sobre?.['total'] as number) ?? items.length,
    pagina: (sobre?.['pagina'] as number) ?? pagina,
    limite: (sobre?.['limite'] as number) ?? limite,
    paginas: (sobre?.['paginas'] as number) ?? 1,
  };
}
