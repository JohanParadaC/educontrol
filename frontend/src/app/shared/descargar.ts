// src/app/shared/descargar.ts
// ---------------------------------------------------------------------------
// Guardar en disco una respuesta del servidor.
//
// No se puede hacer con un `<a href="/api/...">` a secas: la API pide el token
// en una cabecera y un enlace normal no la manda, así que la descarga saldría
// 401. Hay que pedirla con HttpClient —que sí pasa por el interceptor— y
// entregar el resultado al navegador desde aquí.
//
// El nombre del fichero lo decide el servidor en `Content-Disposition`. Se lee
// de ahí y no se inventa en el cliente: quien sabe cómo se llama el curso es
// quien lo tiene.
// ---------------------------------------------------------------------------

/**
 * Saca el nombre de fichero de una cabecera `Content-Disposition`.
 *
 * Prefiere `filename*` (RFC 5987), que es el que lleva las tildes; `filename`
 * es el respaldo en ASCII. Si no hay cabecera —o un proxy la ha quitado— se usa
 * el nombre de reserva.
 */
export function nombreDeCabecera(cabecera: string | null, porDefecto: string): string {
  if (!cabecera) return porDefecto;

  const conCodificacion = /filename\*=UTF-8''([^;]+)/i.exec(cabecera);
  if (conCodificacion) {
    try {
      return decodeURIComponent(conCodificacion[1]);
    } catch {
      // Una cabecera mal codificada no debe impedir la descarga.
    }
  }

  const simple = /filename="?([^";]+)"?/i.exec(cabecera);
  return simple ? simple[1] : porDefecto;
}

/**
 * Entrega un blob al navegador como descarga.
 *
 * El `revokeObjectURL` no es opcional: cada URL creada mantiene el blob vivo en
 * memoria hasta que se libera, y exportar veinte veces sin soltarlas deja
 * veinte copias del fichero en la pestaña.
 */
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
