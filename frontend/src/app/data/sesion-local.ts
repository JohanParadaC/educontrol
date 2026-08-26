// src/app/data/sesion-local.ts
// ---------------------------------------------------------------------------
// Utilidades sobre el usuario guardado en localStorage y sobre identificadores.
//
// Estaban como métodos privados dentro de ApiService, lo que obligaba a que
// cualquier servicio que las necesitara viviera en el mismo fichero. Sacarlas
// es lo que permite partir ApiService por recurso.
// ---------------------------------------------------------------------------

/** Usuario de la sesión actual, tal y como lo dejó AuthService. */
export function usuarioLocal(): any | null {
  try {
    return JSON.parse(localStorage.getItem('usuario') || 'null');
  } catch {
    return null;
  }
}

/**
 * Token de la sesión actual, tal y como lo dejó AuthService.
 *
 * Existe para que el interceptor no tenga que inyectar AuthService: hacerlo
 * creaba una dependencia circular —AuthService valida el token en su
 * constructor, eso dispara una petición, la petición construye el interceptor
 * y el interceptor pide AuthService, que todavía se está construyendo—.
 */
export function tokenLocal(): string {
  return localStorage.getItem('token') || localStorage.getItem('jwt') || '';
}

/** Id de un documento que puede llegar poblado, como string, o no llegar. */
export function idDe(x: any): string {
  if (!x) return '';
  if (typeof x === 'string') return x;
  return (x._id ?? x.id ?? '') as string;
}

/** Compara nombres ignorando tildes y mayúsculas. */
export function normalizar(s: string): string {
  return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
