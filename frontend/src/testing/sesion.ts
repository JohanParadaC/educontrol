// src/testing/sesion.ts
// ---------------------------------------------------------------------------
// Ayudas para montar una sesión en los tests de componentes.
//
// Existen por dos cosas que se aprenden a base de tests rojos:
//
// 1. **Hay que sembrar el token, no solo el usuario.** AuthService borra el
//    usuario guardado si no encuentra token —"token sin usuario no es una
//    sesión, es un resto"—, y entonces `listInscripcionesMe` no sabe de quién
//    son las matrículas y falla antes de salir a la red.
//
// 2. **Hay que limpiar al salir.** AuthService escribe en localStorage de
//    verdad. Un fichero que deja sesión hace que el siguiente arranque con
//    ella, dispare la renovación y se encuentre una petición que no esperaba:
//    un test que pasa o falla según el orden en que se ejecute.
// ---------------------------------------------------------------------------
import { HttpTestingController } from '@angular/common/http/testing';

/** Lo mínimo que la aplicación guarda de quien ha entrado. */
export interface SesionDePrueba {
  id: string;
  rol: 'estudiante' | 'profesor' | 'admin';
  nombre?: string;
  correo?: string;
}

const TOKEN = 'jwt-de-prueba';

/** Deja una sesión iniciada. Limpia antes, por si el fichero anterior no lo hizo. */
export function sembrarSesion(usuario: SesionDePrueba): void {
  localStorage.clear();
  localStorage.setItem('token', TOKEN);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

/**
 * Responde la validación del token que AuthService lanza al construirse, **si
 * la hay**.
 *
 * Sale o no según el componente inyecte AuthService o no, y eso es un detalle
 * suyo que ningún test de pantalla debería estar afirmando: aquí solo se
 * responde para que `verify()` no se encuentre una petición abierta.
 */
export function responderRenovacion(http: HttpTestingController, usuario: SesionDePrueba): void {
  http.match('/api/auth/renew').forEach(r => r.flush({ ok: true, token: TOKEN, usuario }));
}

/** Borra la sesión. Va en el `afterEach`, siempre. */
export function limpiarSesion(): void {
  localStorage.clear();
}
