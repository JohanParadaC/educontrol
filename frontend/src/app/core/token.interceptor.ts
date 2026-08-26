// src/app/core/token.interceptor.ts
// ---------------------------------------------------------------------------
// Pone la cabecera Authorization en las peticiones a la API.
//
// El token se lee del almacenamiento local y NO de AuthService, aunque quede
// raro. Inyectar AuthService aquí formaba un ciclo: AuthService valida el
// token en su constructor, esa validación dispara una petición HTTP, la
// petición construye este interceptor y el interceptor pide AuthService, que
// aún se está construyendo. Angular responde NG0200 y la petición muere ahí,
// sin llegar al servidor: como la renovación "fallaba", AuthService cerraba la
// sesión. En la práctica, iniciar sesión y refrescar la página te echaba fuera.
// ---------------------------------------------------------------------------
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { tokenLocal } from '../data/sesion-local';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = tokenLocal();

    // Considera API si:
    // - es absoluta y empieza por environment.apiBase
    // - o es relativa que contenga "/api"
    const isApi = this.isApiUrl(req.url);

    if (token && isApi) {
      const setHeaders: Record<string, string> = {};

      // Una sola cabecera. Antes se mandaba también `x-token` con el mismo
      // valor porque el backend aceptaba las dos; ya no lo hace.
      if (!req.headers.has('Authorization')) setHeaders['Authorization'] = `Bearer ${token}`;

      const authReq = req.clone({ setHeaders });
      return next.handle(authReq);
    }

    return next.handle(req);
  }

  private isApiUrl(url: string): boolean {
    if (url.startsWith('http')) {
      // Permite pequeñas diferencias de slash final
      const base = environment.apiBase.replace(/\/+$/, '');
      return url.startsWith(base);
    }
    return url.includes('/api');
  }
}
