// src/app/core/rutas.ts
// ---------------------------------------------------------------------------
// Punto único que decide a qué pantalla de inicio corresponde cada rol.
//
// Antes esta decisión estaba escrita cuatro veces (login, landing, navbar y la
// página 404) y además existía un DashboardComponent cuyo único cometido era
// volver a decidirlo en tiempo de render. Cinco sitios para una sola regla.
// ---------------------------------------------------------------------------

export type Rol = 'estudiante' | 'profesor' | 'admin';

/** Pantalla de inicio de cada rol. */
export function rutaInicioPara(rol: Rol | string | null | undefined): string {
  switch (rol) {
    case 'admin':    return '/admin';
    case 'profesor': return '/profesor/dashboard';
    default:         return '/estudiante/inicio';
  }
}
