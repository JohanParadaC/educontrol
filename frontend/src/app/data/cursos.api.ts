// src/app/data/cursos.api.ts
// ---------------------------------------------------------------------------
// Acceso HTTP al recurso /api/cursos.
// La traducción nombre↔titulo la hace curso.mapper y solo él.
// ---------------------------------------------------------------------------
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { Curso, CursoDetalle, CursoEditable } from './curso.model';
import { Usuario } from './usuario.model';
import { aCurso, aCursos, deCurso } from './curso.mapper';
import { Pagina, aPagina, LIMITE_PAGINA, LIMITE_MAXIMO_PAGINA } from './paginacion';

/** Filtros del listado de cursos. `profesor: 'me'` es el atajo del backend. */
export interface FiltroCursos {
  profesor?: string;
  buscar?: string;
}

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
   * La misma petición que `getCurso`, pero sin tirar el contexto.
   *
   * `aCurso` se queda con el curso y descarta el resto de la respuesta, que es
   * justo lo que necesita la ficha: cuántos hay matriculados y, si el servidor
   * ha decidido que puede verlos, quiénes.
   */
  getCursoDetalle(id: string): Observable<CursoDetalle> {
    return this.http.get<any>(`${this.base}/${id}`).pipe(
      map(r => ({
        curso: aCurso(r),
        matriculados: Number(r?.matriculados ?? 0),
        // Ausente si el servidor no la manda. No se sustituye por [].
        estudiantes: Array.isArray(r?.estudiantes) ? r.estudiantes : undefined,
      }))
    );
  }

  /**
   * La lista de matriculados en CSV.
   *
   * Se pide con HttpClient y no con un enlace porque la ruta exige el token en
   * una cabecera, y un `<a href>` no la manda: la descarga saldría 401. Se
   * devuelve la respuesta ENTERA porque el nombre del fichero viene en
   * `Content-Disposition` y lo decide el servidor.
   */
  descargarEstudiantesCsv(id: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/${id}/estudiantes.csv`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  /**
   * Catálogo. `buscar` viaja al servidor: antes se traían 100 cursos y se
   * filtraban aquí, así que a partir del curso 101 la búsqueda mentia sin
   * decirlo.
   */
  listCursos(filtros: FiltroCursos = {}): Observable<Curso[]> {
    return this.listCursosPaginado(1, LIMITE_MAXIMO_PAGINA, filtros).pipe(map(p => p.items));
  }

  listCursosPaginado(
    pagina = 1,
    limite = LIMITE_PAGINA,
    filtros: FiltroCursos = {}
  ): Observable<Pagina<Curso>> {
    let params = new HttpParams().set('page', pagina).set('limit', limite);
    if (filtros.profesor) params = params.set('profesor', filtros.profesor);
    if (filtros.buscar?.trim()) params = params.set('buscar', filtros.buscar.trim());
    return this.http.get<any>(this.base, { params }).pipe(
      map(r => {
        const p = aPagina<any>(r, 'cursos', pagina, limite);
        return { ...p, items: aCursos(p.items) };
      })
    );
  }

  createCurso(body: CursoEditable): Observable<Curso> {
    return this.http.post<any>(this.base, deCurso(body)).pipe(map(aCurso));
  }

  /**
   * Edición parcial: se manda solo lo que cambia.
   *
   * Antes esto leía el curso con un GET y lo reenviaba entero "porque el PUT
   * valida el curso completo". Ya no es cierto: `actualizarCurso` construye el
   * update solo con los campos presentes. El GET previo era una petición de
   * más y una condición de carrera —lees, otro edita, escribes encima de su
   * cambio sin enterarte—.
   */
  updateCurso(id: string, body: CursoEditable): Observable<Curso> {
    return this.http.put<any>(`${this.base}/${id}`, deCurso(body)).pipe(map(aCurso));
  }

  deleteCurso(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Reasigna el profesor: es un cambio parcial más. */
  asignarProfesor(cursoId: string, profesor: string | Usuario): Observable<Curso> {
    return this.updateCurso(cursoId, { profesor } as Partial<Curso>);
  }

  /**
   * Cursos que imparte el usuario de la sesión actual.
   *
   * Lo resuelve el servidor con ?profesor=me. Antes se descargaba el catálogo
   * y se comparaban identificadores aquí, con un respaldo que comparaba
   * nombres normalizados sin tildes "por si los datos son antiguos": dos
   * profesores homónimos compartían clases.
   */
  listCursosDeProfesorMe(): Observable<Curso[]> {
    return this.listCursos({ profesor: 'me' });
  }
}
