import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
// CAMBIO: importa el AuthService desde el mismo folder "core"
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  constructor(
    private auth  : AuthService,
    private router: Router
  ) {}

  /**
   * Si hay sesión → true
   * Si NO hay sesión → redirige a /login
   *
   * CAMBIO: antes redirigía a /auth/login; en tu app la ruta real es /login.
   * CAMBIO: usa el getter `isLoggedIn` (no es un método, no lleva paréntesis).
   */
  canActivate(): boolean | UrlTree {
    return this.auth.isLoggedIn
      ? true
      : this.router.parseUrl('/login'); // CAMBIO
  }
}