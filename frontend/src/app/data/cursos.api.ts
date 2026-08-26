// src/app/data/cursos.api.ts
// ---------------------------------------------------------------------------
// Acceso HTTP al recurso /api/cursos.
// La traducción nombre↔titulo la hace curso.mapper y solo él.
// ---------------------------------------------------------------------------
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { Curso } from './curso.model';
import { Usuario } from './usuario.model';
import { aCurso, aCursos, deCurso } from './curso.mapper';
import { Pagina, aPagina, LIMITE_PAGINA, LIMITE_MAXIMO_PAGINA } from './paginacion';
import { usuarioLocal, idDe, normalizar } from './sesion-local';

@Injectable({ providedIn: 'root' })
export class CursosApi {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/cursos`;

  getCursos(): Observable<Curso[]> {
    return this.http
      .get<any>(this.base)
      .pipe(map(r => aCursos(Array.isArray(r) ? r : (r?.cursos ?? []))));
  }

  getCurso(id: string): Observable<Curso> {
    return this.http.get<any>(`${this.base}/${id}`).pipe(map(aCurso));
  }

  /**
   * Pide el máximo que permite el backend porque el catálogo del estudiante
   * filtra en cliente: si trajera solo la primera página, la búsqueda mentiría
   * sin decirlo. Con catálogos mayores hay que mover el filtro al servidor.
   */
  listCursos(): Observable<Curso[]> {
    return this.listCursosPaginado(1, LIMITE_MAXIMO_PAGINA).pipe(map(p => p.items));
  }

  listCursosPaginado(pagina = 1, limite = LIMITE_PAGINA): Observable<Pagina<Curso>> {
    const params = new HttpParams().set('page', pagina).set('limit', limite);
    return this.http.get<any>(this.base, { params }).pipe(
      map(r => {
        const p = aPagina<any>(r, 'cursos', pagina, limite);
        return { ...p, items: aCursos(p.items) };
      })
    );
  }

  createCurso(
    body: Partial<Curso> & { nombre?: string; descripcion?: string; profesor?: string | Usuario }
  ): Observable<Curso> {
    return this.http.post<any>(this.base, deCurso(body)).pipe(map(aCurso));
  }

  /**
   * El PUT del backend valida el curso completo, así que si la edición es
   * parcial hay que leerlo antes y completar los campos que falten.
   */
  updateCurso(id: string, body: Partial<Curso>): Observable<Curso> {
    const payload = deCurso(body);
    const completo = payload['nombre'] !== undefined && payload['descripcion'] !== undefined;

    const enviar = (base?: Curso) =>
      this.http
        .put<any>(`${this.base}/${id}`, { ...deCurso(base ?? {}), ...payload })
        .pipe(map(aCurso));

    return completo ? enviar() : this.getCurso(id).pipe(switchMap(enviar));
  }

  deleteCurso(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Reasigna el profesor. Lee el curso antes porque el PUT valida el recurso entero. */
  asignarProfesor(cursoId: string, profesor: string | Usuario): Observable<Curso> {
    return this.updateCurso(cursoId, { profesor } as Partial<Curso>);
  }

  /** Cursos que imparte el usuario de la sesión actual. */
  listCursosDeProfesorMe(): Observable<Curso[]> {
    const yo = usuarioLocal();
    const miId = idDe(yo);
    const miNombre = normalizar(yo?.nombre ?? '');

    return this.listCursos().pipe(
      map(cursos =>
        (cursos || []).filter((c: any) => {
          const p = c?.profesor;
          const pid = idDe(p);
          if (pid && miId && String(pid) === String(miId)) return true;

          // Respaldo para datos antiguos en los que el profesor era un nombre.
          const pnombre = typeof p === 'string' ? p : (p?.nombre ?? '');
          return !!(pnombre && miNombre) && normalizar(pnombre) === miNombre;
        })
      )
    );
  }
}
