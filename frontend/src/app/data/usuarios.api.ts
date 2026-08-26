// src/app/data/usuarios.api.ts
// ---------------------------------------------------------------------------
// Acceso HTTP al recurso /api/usuarios.
// ---------------------------------------------------------------------------
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { Usuario } from './usuario.model';
import { Pagina, aPagina, LIMITE_PAGINA, LIMITE_MAXIMO_PAGINA } from './paginacion';

@Injectable({ providedIn: 'root' })
export class UsuariosApi {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/usuarios`;

  getUsuario(id: string): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.base}/${id}`);
  }

  /**
   * Actualiza un usuario.
   * `contraseñaActual` es obligatoria cuando cambias TU propia contraseña;
   * `profesorClave` lo es para activar el perfil de profesor.
   */
  updateUsuario(
    id: string,
    body: Partial<Usuario> & {
      profesorClave?: string;
      contraseña?: string;
      contraseñaActual?: string;
    }
  ): Observable<{ ok: boolean; usuario: Usuario }> {
    return this.http.put<{ ok: boolean; usuario: Usuario }>(`${this.base}/${id}`, body);
  }

  listUsuarios(): Observable<Usuario[]> {
    return this.listUsuariosPaginado().pipe(map(p => p.items));
  }

  /** Conserva los metadatos de paginación, que es lo que necesita un paginador. */
  listUsuariosPaginado(pagina = 1, limite = LIMITE_PAGINA): Observable<Pagina<Usuario>> {
    const params = new HttpParams().set('page', pagina).set('limit', limite);
    return this.http
      .get<any>(this.base, { params })
      .pipe(map(r => aPagina<Usuario>(r, 'usuarios', pagina, limite)));
  }

  /**
   * Usuarios de un rol concreto, para poblar desplegables.
   * Filtra en el servidor: traerse la tabla entera para quedarse con los
   * profesores es justo lo que la paginación viene a evitar.
   */
  listUsuariosPorRol(rol: 'estudiante' | 'profesor' | 'admin'): Observable<Usuario[]> {
    const params = new HttpParams().set('rol', rol).set('limit', LIMITE_MAXIMO_PAGINA);
    return this.http
      .get<any>(this.base, { params })
      .pipe(map(r => aPagina<Usuario>(r, 'usuarios', 1, LIMITE_MAXIMO_PAGINA).items));
  }
}
