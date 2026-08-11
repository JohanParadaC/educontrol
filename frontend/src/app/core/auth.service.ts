import { Injectable } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Usuario } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** ---- Estado de usuario ------------------------------------------ */
  private user$ = new BehaviorSubject<Usuario | null>(null);
  userObservable = this.user$.asObservable();

  /** ---- Claves para LS --------------------------------------------- */
  private readonly TOKEN_KEY = 'token';
  private readonly USER_KEY  = 'usuario';

  constructor(private api: ApiService) {
    // CAMBIO: rehidratar usuario desde LS para evitar "parpadeo" de UI
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userStr = localStorage.getItem(this.USER_KEY);
    if (userStr) {
      try { this.user$.next(JSON.parse(userStr) as Usuario); } catch {}
    }

    if (token) {
      // Valida y renueva con backend; si falla, hace logout
      this.validateToken();
    } else {
      localStorage.removeItem(this.USER_KEY);
    }
  }

  /** ---- Login ------------------------------------------------------- */
  login(credentials: { correo: string; password?: string; contrasena?: string; contraseña?: string }) {
    const pass =
      credentials.password ??
      credentials.contraseña ??
      credentials.contrasena ??
      '';

    // Mandamos ambas claves por si acaso (el backend ya es tolerante igual)
    const body: any = { correo: credentials.correo, password: pass, contraseña: pass };

    return this.api.login(body).pipe(
      tap(({ token, usuario }) => this.setSession(token, usuario))
    );
  }

  /** ---- Logout ------------------------------------------------------ */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.user$.next(null);
  }

  /** ---- Utilidades -------------------------------------------------- */
  isLogged(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }
  get isLoggedIn(): boolean {
    return this.isLogged();
  }

  /** Token para interceptor */
  get token(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /** ✅ Getter/Setter de usuario para usar desde componentes */
  get usuario(): Usuario | null {
    const inMem = this.user$.value;
    if (inMem) return inMem;
    const fromLS = localStorage.getItem(this.USER_KEY);
    return fromLS ? (JSON.parse(fromLS) as Usuario) : null;
  }
  set usuario(u: Usuario | null) {
    this.user$.next(u);
    if (u) localStorage.setItem(this.USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(this.USER_KEY);
  }

  /* ---- helpers privados -------------------------------------------- */
  private setSession(token: string, usuario: Usuario): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(usuario));
    this.user$.next(usuario);
  }

  private validateToken(): void {
    // Guardamos con qué token salimos: la respuesta puede tardar y, mientras,
    // el usuario puede haber iniciado sesión de nuevo.
    const tokenValidado = localStorage.getItem(this.TOKEN_KEY);

    this.api.renew().subscribe({
      next: ({ token, usuario }) => {
        // Si la sesión ya cambió, no pisamos la nueva con una respuesta vieja.
        if (localStorage.getItem(this.TOKEN_KEY) !== tokenValidado) return;
        this.setSession(token, usuario);
      },
      error: () => {
        // 🔒 Solo cerramos sesión si seguimos hablando del MISMO token.
        //
        // Sin esta comprobación, un token caducado producía esto: arrancas la
        // app, la renovación falla de fondo, mientras tanto inicias sesión bien
        // y, un instante después, el logout de la renovación borra la sesión
        // recién creada. Se veía como "he entrado y me ha echado al login".
        if (localStorage.getItem(this.TOKEN_KEY) !== tokenValidado) return;
        this.logout();
      }
    });
  }
}