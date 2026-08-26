// src/app/core/auth.guard.ts
// ---------------------------------------------------------------------------
// Deja pasar si hay sesión; si no, manda al login.
//
// Es una función (CanActivateFn) y no una clase con CanActivate: en Angular 20
// las clases de guard están desaconsejadas y obligan a un @Injectable y a un
// constructor para pedir dos dependencias.
// ---------------------------------------------------------------------------
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.estaAutenticado() ? true : router.parseUrl('/login');
};
