// src/app/core/admin.guard.ts
// ---------------------------------------------------------------------------
// Deja entrar al panel de administración solo si el servidor confirma que
// quien llama es admin.
//
// Antes decidía con `auth.usuario.rol`, que sale de localStorage y el propio
// usuario puede editar desde las herramientas del navegador. No era una brecha
// —la API rechaza cada petición con 403— pero la experiencia era pésima: en vez
// de "no tienes acceso" veías el panel entero lleno de errores. Ahora pregunta
// a /api/auth/renew, que es la única fuente que no se puede falsear desde el
// cliente.
//
// Es `canMatch` y no `canActivate`: así un no-admin ni siquiera descarga el
// bundle del panel.
//
// Y si no puede entrar, va a la pantalla de inicio de SU rol, decidida en
// core/rutas.ts. Antes redirigía a /cursos, que un profesor no puede usar.
// ---------------------------------------------------------------------------
import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, map, of } from 'rxjs';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { rutaInicioPara } from './rutas';

export const adminGuard: CanMatchFn = () => {
  const api = inject(ApiService);
  const auth = inject(AuthService);
  const router = inject(Router);
  const snack = inject(MatSnackBar);

  return api.renew().pipe(
    map(({ usuario }) => {
      // La respuesta trae el rol de verdad: se aprovecha para poner al día la
      // sesión, por si a alguien le han cambiado el rol mientras navegaba.
      auth.actualizarUsuario(usuario);

      if (usuario?.rol === 'admin') return true;

      snack.open('Acceso restringido a administradores', 'Cerrar', { duration: 2500 });
      return router.parseUrl(rutaInicioPara(usuario?.rol));
    }),
    catchError(() => {
      // Token caducado, red caída o servidor que no responde: no se puede
      // afirmar que sea admin, así que no entra.
      return of(router.parseUrl('/login'));
    })
  );
};
