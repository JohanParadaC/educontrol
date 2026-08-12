// src/app/data/inscripciones.api.ts
// ---------------------------------------------------------------------------
// Acceso HTTP al recurso /api/inscripciones.
//
// El backend devuelve `estudiante` y `curso` POBLADOS, así que quien consuma
// esto no necesita cruzar nada con la lista de usuarios.
// ---------------------------------------------------------------------------
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { Inscripcion } from '../models/inscripcion.model';
import { usuarioLocal, idDe } from './sesion-local';

@Injectable({ providedIn: 'root' })
export class InscripcionesApi {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/inscripciones`;

  listInscripciones(): Observable<Inscripcion[]> {
    return this.http
      .get<any>(this.base)
      .pipe(map(r => (Array.isArray(r) ? r : (r?.inscripciones ?? []))));
  }

  createInscripcion(body: { curso: string; estudiante: string }): Observable<Inscripcion> {
    // El backend espera cursoId/estudianteId, no curso/estudiante.
    const payload = { cursoId: body.curso, estudianteId: body.estudiante };
    return this.http
      .post<any>(this.base, payload)
      .pipe(map(r => r?.inscripcion ?? r));
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
    return this.listInscripciones().pipe(
      map(todas => (todas || []).filter((i: any) => idDe(i?.estudiante) === miId))
    );
  }

  listInscripcionesPorCurso(cursoId: string): Observable<Inscripcion[]> {
    return this.listInscripciones().pipe(
      map(ins => (ins || []).filter((i: any) => String(idDe(i?.curso)) === String(cursoId)))
    );
  }
}
