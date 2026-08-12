// src/app/core/api.service.ts
// ---------------------------------------------------------------------------
// Fachada sobre los servicios de datos por recurso.
//
// Era un fichero de 414 líneas con 44 símbolos: el mayor del frontend. Ahora el
// código vive en data/{usuarios,cursos,inscripciones,auth}.api.ts, cada uno con
// un solo recurso, y esto queda como capa de compatibilidad para que los nueve
// componentes que ya lo inyectan sigan funcionando sin tocarlos.
//
// 👉 El código nuevo debería inyectar el servicio concreto (UsuariosApi,
//    CursosApi, InscripcionesApi, AuthApi) en lugar de esta fachada.
//
// De paso desaparecen diez métodos que no llamaba nadie, entre ellos
// `cancelarInscripcion()`, que apuntaba a `PATCH /api/inscripciones/:id/cancelar`
// — una ruta que el backend no define.
// ---------------------------------------------------------------------------
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Usuario } from '../models/usuario.model';
import { Curso } from '../models/curso.model';
import { Inscripcion } from '../models/inscripcion.model';

import { AuthApi, RespuestaSesion } from '../data/auth.api';
import { UsuariosApi } from '../data/usuarios.api';
import { CursosApi } from '../data/cursos.api';
import { InscripcionesApi } from '../data/inscripciones.api';
import { Pagina, LIMITE_PAGINA } from '../data/paginacion';

export { LIMITE_PAGINA, LIMITE_MAXIMO_PAGINA, type Pagina } from '../data/paginacion';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private authApi = inject(AuthApi);
  private usuarios = inject(UsuariosApi);
  private cursos = inject(CursosApi);
  private inscripciones = inject(InscripcionesApi);

  // ---------------- AUTH ----------------
  login(body: { correo: string; password: string }): Observable<RespuestaSesion> {
    return this.authApi.login(body);
  }
  renew(): Observable<RespuestaSesion> {
    return this.authApi.renew();
  }
  register(body: { nombre: string; correo: string; password: string; rol?: 'estudiante' | 'profesor' }) {
    return this.authApi.register(body);
  }

  // ---------------- USUARIOS ----------------
  getUsuario(id: string): Observable<Usuario> {
    return this.usuarios.getUsuario(id);
  }
  updateUsuario(
    id: string,
    body: Partial<Usuario> & { profesorClave?: string; 'contraseña'?: string; 'contraseñaActual'?: string }
  ) {
    return this.usuarios.updateUsuario(id, body);
  }
  listUsuarios(): Observable<Usuario[]> {
    return this.usuarios.listUsuarios();
  }
  listUsuariosPaginado(pagina = 1, limite = LIMITE_PAGINA): Observable<Pagina<Usuario>> {
    return this.usuarios.listUsuariosPaginado(pagina, limite);
  }
  listUsuariosPorRol(rol: 'estudiante' | 'profesor' | 'admin'): Observable<Usuario[]> {
    return this.usuarios.listUsuariosPorRol(rol);
  }

  // ---------------- CURSOS ----------------
  getCursos(): Observable<Curso[]> {
    return this.cursos.getCursos();
  }
  getCurso(id: string): Observable<Curso> {
    return this.cursos.getCurso(id);
  }
  listCursos(): Observable<Curso[]> {
    return this.cursos.listCursos();
  }
  listCursosPaginado(pagina = 1, limite = LIMITE_PAGINA): Observable<Pagina<Curso>> {
    return this.cursos.listCursosPaginado(pagina, limite);
  }
  createCursoAdmin(body: { titulo: string; descripcion: string; profesor?: string | Usuario }): Observable<Curso> {
    return this.cursos.createCurso(body as any);
  }
  updateCurso(id: string, body: Partial<Curso>): Observable<Curso> {
    return this.cursos.updateCurso(id, body);
  }
  deleteCurso(id: string): Observable<void> {
    return this.cursos.deleteCurso(id);
  }
  asignarProfesor(cursoId: string, profesor: string | Usuario): Observable<Curso> {
    return this.cursos.asignarProfesor(cursoId, profesor);
  }
  listCursosDeProfesorMe(): Observable<Curso[]> {
    return this.cursos.listCursosDeProfesorMe();
  }

  // ---------------- INSCRIPCIONES ----------------
  listInscripciones(): Observable<Inscripcion[]> {
    return this.inscripciones.listInscripciones();
  }
  createInscripcion(body: { curso: string; estudiante: string }): Observable<Inscripcion> {
    return this.inscripciones.createInscripcion(body);
  }
  enrollMe(cursoId: string): Observable<Inscripcion> {
    return this.inscripciones.enrollMe(cursoId);
  }
  listInscripcionesMe(): Observable<Inscripcion[]> {
    return this.inscripciones.listInscripcionesMe();
  }
  listInscripcionesPorCurso(cursoId: string): Observable<Inscripcion[]> {
    return this.inscripciones.listInscripcionesPorCurso(cursoId);
  }
}
