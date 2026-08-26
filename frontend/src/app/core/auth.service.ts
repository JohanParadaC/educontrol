// src/app/core/auth.service.ts
// ---------------------------------------------------------------------------
// La sesión: quién ha entrado y con qué token.
//
// El estado vive en señales. Antes era un BehaviorSubject con getters, y el de
// `usuario` hacía `JSON.parse(localStorage)` cada vez que no había nada en
// memoria. Como se lee desde las plantillas, eso era un parse por ciclo de
// detección de cambios. Ahora el almacenamiento local se lee UNA vez, al
// construir el servicio, y a partir de ahí manda la señal.
// ---------------------------------------------------------------------------
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, shareReplay, tap } from 'rxjs';

import { RespuestaSesion } from '../data/auth.api';

import { ApiService } from './api.service';
import { Usuario } from '../data/usuario.model';

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

/** Lee el usuario guardado. Si hay basura, se ignora y ya lo dirá la renovación. */
function usuarioGuardado(): Usuario | null {
  const crudo = localStorage.getItem(CLAVE_USUARIO);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as Usuario;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  /** Renovación en curso, si la hay: sirve para no pedir dos veces lo mismo. */
  private enVuelo: Observable<RespuestaSesion> | null = null;

  /** Escritura solo desde aquí dentro; fuera se lee. */
  private readonly _usuario = signal<Usuario | null>(usuarioGuardado());
  private readonly _token = signal<string | null>(localStorage.getItem(CLAVE_TOKEN));

  /** Usuario de la sesión actual. Se lee llamándola: `auth.usuario()`. */
  readonly usuario = this._usuario.asReadonly();

  /**
   * Hay sesión mientras haya token.
   *
   * No depende de `usuario`: el token es lo que el servidor comprueba, y puede
   * haber token válido mientras el usuario todavía no se ha rehidratado.
   */
  readonly estaAutenticado = computed(() => !!this._token());

  /** El rol de quien ha entrado, o cadena vacía si no hay nadie. */
  readonly rol = computed(() => this._usuario()?.rol ?? '');

  constructor() {
    if (this._token()) {
      // Valida y renueva contra el servidor; si falla, cierra la sesión.
      this.validarToken();
    } else {
      // Token sin usuario no es una sesión, es un resto.
      localStorage.removeItem(CLAVE_USUARIO);
      this._usuario.set(null);
    }
  }

  login(credentials: { correo: string; password: string }) {
    // Un solo nombre. Aquí se aceptaban tres alias —password, contrasena,
    // contraseña— y se elegía el primero que viniera, pero la traducción al
    // campo `contraseña` que espera el backend ya la hace AuthApi, y solo
    // debe estar en un sitio.
    return this.api
      .login(credentials)
      .pipe(tap(({ token, usuario }) => this.guardarSesion(token, usuario)));
  }

  logout(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    this._token.set(null);
    this._usuario.set(null);
  }

  /** Refresca los datos del usuario sin tocar el token (cambio de nombre, de rol…). */
  actualizarUsuario(usuario: Usuario | null): void {
    if (usuario) localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    else localStorage.removeItem(CLAVE_USUARIO);
    this._usuario.set(usuario);
  }

  /**
   * Renovación compartida.
   *
   * Al abrir /admin salían DOS peticiones a /api/auth/renew: una del arranque
   * de este servicio y otra del guard del panel, que pregunta al servidor
   * antes de dejar entrar. Son la misma pregunta hecha con medio segundo de
   * diferencia. Si ya hay una en vuelo, la segunda se engancha a ella.
   *
   * No se cachea más allá de eso: en cuanto termina, la siguiente llamada
   * vuelve a preguntar. Un rol que cambia tiene que notarse.
   */
  renovar(): Observable<RespuestaSesion> {
    if (this.enVuelo) return this.enVuelo;

    this.enVuelo = this.api.renew().pipe(
      finalize(() => (this.enVuelo = null)),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.enVuelo;
  }

  /** Token en crudo. Lo usa quien tenga que hablar con la API por su cuenta. */
  get token(): string | null {
    return this._token();
  }

  /* ---- helpers privados -------------------------------------------- */
  private guardarSesion(token: string, usuario: Usuario): void {
    localStorage.setItem(CLAVE_TOKEN, token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    this._token.set(token);
    this._usuario.set(usuario);
  }

  private validarToken(): void {
    // Con qué token salimos: la respuesta puede tardar y, mientras, el usuario
    // puede haber iniciado sesión de nuevo.
    const tokenValidado = localStorage.getItem(CLAVE_TOKEN);

    this.renovar().subscribe({
      next: ({ token, usuario }) => {
        // Si la sesión ya cambió, no pisamos la nueva con una respuesta vieja.
        if (localStorage.getItem(CLAVE_TOKEN) !== tokenValidado) return;
        this.guardarSesion(token, usuario);
      },
      error: () => {
        // 🔒 Solo cerramos sesión si seguimos hablando del MISMO token.
        //
        // Sin esta comprobación, un token caducado producía esto: arrancas la
        // app, la renovación falla de fondo, mientras tanto inicias sesión bien
        // y, un instante después, el logout de la renovación borra la sesión
        // recién creada. Se veía como "he entrado y me ha echado al login".
        if (localStorage.getItem(CLAVE_TOKEN) !== tokenValidado) return;
        this.logout();
      },
    });
  }
}
