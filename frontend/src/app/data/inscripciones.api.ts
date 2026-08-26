// src/app/data/inscripciones.api.ts
// ---------------------------------------------------------------------------
// Acceso HTTP al recurso /api/inscripciones.
//
// El backend devuelve `estudiante` y `curso` POBLADOS, así que quien consuma
// esto no necesita cruzar nada con la lista de usuarios.
//
// Quién ve qué lo decide el servidor a partir del rol de quien pregunta:
// un estudiante recibe solo las suyas, un profesor las de los cursos que
// imparte y un administrador todas. Antes este endpoint devolvía la colección
// entera a cualquiera y el filtrado se hacía aquí, en el navegador: además de
// filtrar los correos de todo el mundo, obligaba a descargarlos.
//
// Por eso `curso` y `estudiante` van como parámetros de consulta y no como
// `.filter()`: el servidor los cruza con lo que el rol permite ver.
// ---------------------------------------------------------------------------
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { Inscripcion } from './inscripcion.model';
import { aCurso } from './curso.mapper';
import { LIMITE_MAXIMO_PAGINA } from './paginacion';
import { usuarioLocal, idDe } from './sesion-local';

/**
 * El curso llega poblado del backend, o sea con `nombre`. La interfaz lo llama
 * `titulo`, y esa traducción vive en curso.mapper y solo ahí: sin pasar por
 * él, "Mis cursos" pintaba un guión en lugar del título.
 */
const conCursoTraducido = (i: any): Inscripcion => ({
  ...i,
  curso: i?.curso && typeof i.curso === 'object' ? aCurso(i.curso) : i?.curso,
});

/** Filtros que acepta el listado. Se aplican siempre dentro de lo que el rol permite. */
export interface FiltroInscripciones {
  curso?: string;
  estudiante?: string;
  limite?: number;
}

@Injectable({ providedIn: 'root' })
export class InscripcionesApi {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/inscripciones`;

  /**
   * Listado paginado. Se pide el tope duro del backend (100) porque ninguna de
   * las pantallas que lo usan tiene todavía paginador propio; pasadas las 100
   * matrículas de un curso, esto necesita paginación de verdad.
   */
  listInscripciones(filtros: FiltroInscripciones = {}): Observable<Inscripcion[]> {
    let params = new HttpParams().set('limit', String(filtros.limite ?? LIMITE_MAXIMO_PAGINA));
    if (filtros.curso) params = params.set('curso', filtros.curso);
    if (filtros.estudiante) params = params.set('estudiante', filtros.estudiante);

    return this.http
      .get<any>(this.base, { params })
      .pipe(map(r => (Array.isArray(r) ? r : (r?.inscripciones ?? [])).map(conCursoTraducido)));
  }

  createInscripcion(body: { curso: string; estudiante: string }): Observable<Inscripcion> {
    // El backend espera cursoId/estudianteId, no curso/estudiante.
    const payload = { cursoId: body.curso, estudianteId: body.estudiante };
    return this.http.post<any>(this.base, payload).pipe(map(r => r?.inscripcion ?? r));
  }

  /** Matricula al usuario de la sesión actual en un curso. */
  enrollMe(cursoId: string): Observable<Inscripcion> {
    const estudianteId = idDe(usuarioLocal());
    if (!estudianteId) throw new Error('No hay usuario autenticado para matricular.');
    return this.createInscripcion({ curso: cursoId, estudiante: estudianteId });
  }

  /** Inscripciones del usuario de la sesión actual. */
  listInscripcionesMe(): Observable<Inscripcion[]> {
    const miId = idDe(usuarioLocal());
    // Sin sesión se falla en voz alta. Mandar el filtro vacío significaría
    // "todo lo que mi rol permita", que no es lo mismo que "lo mío", y
    // devolver una lista vacía sería decir "no tienes cursos" cuando lo que
    // pasa es que no hay sesión.
    if (!miId) return throwError(() => new Error('No hay usuario autenticado.'));
    return this.listInscripciones({ estudiante: miId });
  }

  listInscripcionesPorCurso(cursoId: string): Observable<Inscripcion[]> {
    return this.listInscripciones({ curso: cursoId });
  }

  /**
   * Da de baja una matrícula. Un estudiante puede con la suya; un admin, con
   * cualquiera. Lo decide el servidor leyendo de quién es.
   */
  deleteInscripcion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
