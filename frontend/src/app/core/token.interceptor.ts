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
      localStorage.getItem('jwt') ||
      '';

    // Considera API si:
    // - es absoluta y empieza por environment.apiBase
    // - o es relativa que contenga "/api"
    const isApi = this.isApiUrl(req.url);

    if (token && isApi) {
      const setHeaders: Record<string, string> = {};

      // No pisar si ya vienen
      if (!req.headers.has('Authorization')) setHeaders['Authorization'] = `Bearer ${token}`;
      if (!req.headers.has('x-token'))        setHeaders['x-token'] = token;

      // 🔎 log (puedes quitarlo luego)
      // console.debug('[TokenInterceptor]', { url: req.url, headers: setHeaders });

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