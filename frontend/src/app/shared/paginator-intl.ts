// src/app/shared/paginator-intl.ts
// ---------------------------------------------------------------------------
// Textos del paginador de Material en español.
//
// Por defecto trae "Items per page", "of", "Next page"… en inglés, lo que canta
// en una aplicación que está entera en español. También afecta a los lectores
// de pantalla: los aria-label de las flechas salen de aquí.
// ---------------------------------------------------------------------------
import { MatPaginatorIntl } from '@angular/material/paginator';

export function paginatorIntlEs(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();

  intl.itemsPerPageLabel = 'Por página:';
  intl.nextPageLabel = 'Página siguiente';
  intl.previousPageLabel = 'Página anterior';
  intl.firstPageLabel = 'Primera página';
  intl.lastPageLabel = 'Última página';

  intl.getRangeLabel = (pagina: number, tamano: number, total: number): string => {
    if (total === 0) return 'Sin resultados';

    const desde = pagina * tamano;
    // El último tramo puede quedar corto: no anunciamos más de los que hay.
    const hasta = Math.min(desde + tamano, total);

    return `${desde + 1} – ${hasta} de ${total}`;
  };

  return intl;
}
