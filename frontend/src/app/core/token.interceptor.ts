// src/app/core/token.interceptor.ts
// ---------------------------------------------------------------------------
// Pone la cabecera Authorization en las peticiones a la API.
//
// Es una función y no una clase: `withInterceptors([tokenInterceptor])` en vez
// de una clase registrada en HTTP_INTERCEPTORS con withInterceptorsFromDi().
//
// El token se lee del almacenamiento local y NO de AuthService, aunque quede
// raro. Inyectar AuthService aquí formaba un ciclo: AuthService valida el
// token en su constructor, esa validación dispara una petición HTTP, la
// petición construye este interceptor y el interceptor pide AuthService, que
// aún se está construyendo. Angular responde NG0200 y la petición muere ahí,
// sin llegar al servidor: como la renovación "fallaba", AuthService cerraba la
// sesión. En la práctica, iniciar sesión y refrescar la página te echaba fuera.
// ---------------------------------------------------------------------------
import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { tokenLocal } from '../data/sesion-local';

/**
 * ¿Va esta petición a nuestra API?
 *
 * Absoluta: tiene que empezar por `apiBase`. Relativa: le basta con contener
 * "/api". Así una plantilla o un recurso estático no se llevan el token.
 */
function esDeLaApi(url: string): boolean {
  if (url.startsWith('http')) {
    // Tolera la barra final de más o de menos.
    const base = environment.apiBase.replace(/\/+$/, '');
    return url.startsWith(base);
  }
  return url.includes('/api');
}

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = tokenLocal();

  // Si la petición ya trae Authorization, manda quien la escribió.
  if (!token || !esDeLaApi(req.url) || req.headers.has('Authorization')) {
    return next(req);
  }

  // Una sola cabecera. Antes se mandaba también `x-token` con el mismo valor
  // porque el backend aceptaba las dos; ya no lo hace.
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
