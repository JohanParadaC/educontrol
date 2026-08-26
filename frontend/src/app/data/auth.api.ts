// src/app/data/auth.api.ts
// ---------------------------------------------------------------------------
// Acceso HTTP a /api/auth y al registro público (/api/usuarios POST).
//
// La escritura en localStorage la hace AuthService, no este servicio: aquí solo
// se habla HTTP. Antes ambos escribían el token, cada uno por su cuenta.
// ---------------------------------------------------------------------------
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Usuario } from './usuario.model';

export interface RespuestaSesion {
  token: string;
  usuario: Usuario;
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private http = inject(HttpClient);
  private base = environment.apiBase;

  login(body: { correo: string; password: string }): Observable<RespuestaSesion> {
    // El campo del backend lleva tilde.
    const payload = { correo: body.correo, ['contraseña']: body.password };
    return this.http.post<RespuestaSesion>(`${this.base}/auth/login`, payload);
  }

  renew(): Observable<RespuestaSesion> {
    return this.http.get<RespuestaSesion>(`${this.base}/auth/renew`);
  }

  register(body: {
    nombre: string;
    correo: string;
    password: string;
    rol?: 'estudiante' | 'profesor';
    profesorClave?: string;
  }): Observable<{ ok: boolean; usuario: Usuario }> {
    const payload: any = {
      nombre: body.nombre,
      correo: body.correo,
      ['contraseña']: body.password,
      rol: body.rol ?? 'estudiante',
    };
    if (body.profesorClave) payload.profesorClave = body.profesorClave;

    return this.http.post<{ ok: boolean; usuario: Usuario }>(`${this.base}/usuarios`, payload);
  }
}
