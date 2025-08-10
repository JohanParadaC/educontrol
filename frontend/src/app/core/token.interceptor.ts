import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler, HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../core/auth.service';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Sólo adjuntamos a llamadas de API (ajusta si usas env.api)
    const isApiCall = req.url.startsWith('/api') || req.url.includes('/api/');

    const token = this.auth.token || localStorage.getItem('token'); // ← fallback
    if (token && isApiCall) {
      const authReq = req.clone({
        setHeaders: {
          // Backend ya acepta Authorization (y también x-token por compat)
          Authorization: `Bearer ${token}`,
          // 'x-token': token, // (opcional) compatibilidad extra
        }
      });
      return next.handle(authReq);
    }
    return next.handle(req);
  }
}