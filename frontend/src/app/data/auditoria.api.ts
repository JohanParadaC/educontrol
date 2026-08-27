// src/app/data/auditoria.api.ts
// ---------------------------------------------------------------------------
// Acceso HTTP a /api/auditoria. Solo lectura: el historial lo escriben los
// controladores del backend y nadie más, ni siquiera desde aquí.
// ---------------------------------------------------------------------------
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { AccionAuditada, RegistroAuditoria } from './auditoria.model';
import { Pagina, aPagina, LIMITE_PAGINA } from './paginacion';

export interface FiltroAuditoria {
  accion?: AccionAuditada | '';
  buscar?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditoriaApi {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/auditoria`;

  listar(
    pagina = 1,
    limite = LIMITE_PAGINA,
    filtros: FiltroAuditoria = {}
  ): Observable<Pagina<RegistroAuditoria>> {
    let params = new HttpParams().set('page', pagina).set('limit', limite);
    if (filtros.accion) params = params.set('accion', filtros.accion);
    if (filtros.buscar?.trim()) params = params.set('buscar', filtros.buscar.trim());

    return this.http
      .get<unknown>(this.base, { params })
      .pipe(map(r => aPagina<RegistroAuditoria>(r, 'registros', pagina, limite)));
  }
}
