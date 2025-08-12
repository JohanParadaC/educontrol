import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from '../core/auth.service';
import { environment } from '../../environments/environment';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token =
      this.auth?.token ||
      localStorage.getItem('token') ||
      localStorage.getItem('jwt') || '';

    // Solo adjuntamos token a llamadas contra la API del backend
    const isApi = this.isApiUrl(req.url);

    if (token && isApi) {
      // No pisar headers si el caller ya los envió
      const setHeaders: Record<string, string> = {};
      if (!req.headers.has('Authorization')) setHeaders['Authorization'] = `Bearer ${token}`;
      if (!req.headers.has('x-token'))        setHeaders['x-token'] = token;

      const authReq = req.clone({ setHeaders });
      return next.handle(authReq);
    }

    return next.handle(req);
  }

  /** Detecta si la URL apunta a la API (absoluta o relativa) */
  private isApiUrl(url: string): boolean {
    // absoluta hacia nuestro backend
    if (url.startsWith('http')) {
      // si tu environment.apiBase termina en /api, esto cubre todo
      return url.startsWith(environment.apiBase);
    }
    // relativa en el front
    return url.startsWith('/api') || url.includes('/api/');
  }
}