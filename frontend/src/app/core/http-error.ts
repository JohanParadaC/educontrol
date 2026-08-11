// src/app/core/http-error.ts
// ---------------------------------------------------------------------------
// Traduce un HttpErrorResponse a un mensaje que le sirva a la persona que lo lee.
//
// Antes todos los fallos de login mostraban "Credenciales inválidas", incluso
// cuando el servidor no estaba levantado: el usuario reescribía su contraseña
// una y otra vez mientras el problema era otro. Un mensaje de error que miente
// es peor que no tener mensaje.
// ---------------------------------------------------------------------------
import { HttpErrorResponse } from '@angular/common/http';

/**
 * @param err error capturado en el `error` de un subscribe
 * @param mensajePorDefecto qué decir cuando el servidor rechaza la petición
 *        por un motivo esperado (400/401/403) y no manda texto propio
 */
export function mensajeDeError(err: unknown, mensajePorDefecto: string): string {
  const e = err as HttpErrorResponse;

  // status 0 → la petición no llegó a salir: servidor caído, sin red o CORS.
  if (e?.status === 0) {
    return 'No se pudo conectar con el servidor. Comprueba que está arrancado e inténtalo otra vez.';
  }

  // El backend manda { ok: false, msg: '...' } en los errores previstos.
  const delServidor = e?.error?.msg;
  if (typeof delServidor === 'string' && delServidor.trim()) return delServidor;

  if (e?.status >= 500) {
    return 'El servidor ha tenido un problema. Inténtalo de nuevo en un momento.';
  }

  return mensajePorDefecto;
}
