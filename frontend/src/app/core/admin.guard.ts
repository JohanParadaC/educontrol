// src/app/core/admin.guard.ts
// -----------------------------------------------------------------------------
// Guard que permite pasar SOLO si el usuario autenticado tiene rol === 'admin'.
// Si no es admin, redirige a /cursos y muestra un aviso.
// -----------------------------------------------------------------------------
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
    private snack: MatSnackBar
  ) {}

  canActivate(): boolean | UrlTree {
    const u = this.auth.usuario;
    if (u?.rol === 'admin') return true;

    this.snack.open('Acceso restringido a administradores', 'Cerrar', { duration: 2500 });
    return this.router.createUrlTree(['/cursos']);
  }
}