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
import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Usuario } from '../data/usuario.model';
import { Curso, CursoDetalle, CursoEditable } from '../data/curso.model';
import { Inscripcion } from '../data/inscripcion.model';

import { AuthApi, RespuestaSesion } from '../data/auth.api';
import { UsuariosApi } from '../data/usuarios.api';
import { CursosApi, FiltroCursos } from '../data/cursos.api';
import { InscripcionesApi, FiltroInscripciones } from '../data/inscripciones.api';
import { AuditoriaApi, FiltroAuditoria } from '../data/auditoria.api';
import { RegistroAuditoria } from '../data/auditoria.model';
import { Pagina, LIMITE_PAGINA } from '../data/paginacion';

export { LIMITE_PAGINA, LIMITE_MAXIMO_PAGINA, type Pagina } from '../data/paginacion';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private authApi = inject(AuthApi);
  private usuarios = inject(UsuariosApi);
  private cursos = inject(CursosApi);
  private inscripciones = inject(InscripcionesApi);
  private auditoria = inject(AuditoriaApi);

  // ---------------- AUTH ----------------
  login(body: { correo: string; password: string }): Observable<RespuestaSesion> {
    return this.authApi.login(body);
  }
  renew(): Observable<RespuestaSesion> {
    return this.authApi.renew();
  }
  register(body: {
    nombre: string;
    correo: string;
    password: string;
    rol?: 'estudiante' | 'profesor';
  }) {
    return this.authApi.register(body);
  }

  // ---------------- USUARIOS ----------------
  // `getUsuario` no está aquí: no lo llamaba ningún componente, y el servidor
  // solo lo sirve para la propia cuenta o para un admin. Quien lo necesite que
  // inyecte UsuariosApi, que es lo que pide la cabecera de este fichero.
  updateUsuario(
    id: string,
    body: Partial<Usuario> & {
      profesorClave?: string;
      contraseña?: string;
      contraseñaActual?: string;
    }
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
  /** El curso con su contexto: matriculados y, si procede, quiénes son. */
  getCursoDetalle(id: string): Observable<CursoDetalle> {
    return this.cursos.getCursoDetalle(id);
  }
  /** Catálogo. `buscar` y `profesor` los resuelve el servidor. */
  listCursos(filtros: FiltroCursos = {}): Observable<Curso[]> {
    return this.cursos.listCursos(filtros);
  }
  listCursosPaginado(
    pagina = 1,
    limite = LIMITE_PAGINA,
    filtros: FiltroCursos = {}
  ): Observable<Pagina<Curso>> {
    return this.cursos.listCursosPaginado(pagina, limite, filtros);
  }
  createCursoAdmin(body: CursoEditable): Observable<Curso> {
    return this.cursos.createCurso(body);
  }
  updateCurso(id: string, body: CursoEditable): Observable<Curso> {
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
  /** La lista de matriculados en CSV, con la respuesta entera: el nombre del
      fichero viene en una cabecera. */
  descargarEstudiantesCsv(id: string): Observable<HttpResponse<Blob>> {
    return this.cursos.descargarEstudiantesCsv(id);
  }

  // ---------------- AUDITORÍA ----------------
  /** El historial de acciones administrativas. Solo lo puede leer un admin. */
  listAuditoria(pagina = 1, limite = LIMITE_PAGINA, filtros: FiltroAuditoria = {}) {
    return this.auditoria.listar(pagina, limite, filtros) as Observable<Pagina<RegistroAuditoria>>;
  }

  // ---------------- INSCRIPCIONES ----------------
  /**
   * Devuelve lo que el rol de la sesión permite ver: un estudiante recibe las
   * suyas, un profesor las de sus cursos y un administrador todas. Los filtros
   * se cruzan con esa regla en el servidor.
   */
  listInscripciones(filtros: FiltroInscripciones = {}): Observable<Inscripcion[]> {
    return this.inscripciones.listInscripciones(filtros);
  }
  createInscripcion(body: { curso: string; estudiante: string }): Observable<Inscripcion> {
    return this.inscripciones.createInscripcion(body);
  }
  enrollMe(cursoId: string): Observable<Inscripcion> {
    return this.inscripciones.enrollMe(cursoId);
  }
  /** Matricula a alguien por su correo. Es la vía del profesor. */
  matricularPorCorreo(cursoId: string, correo: string): Observable<Inscripcion> {
    return this.inscripciones.matricularPorCorreo(cursoId, correo);
  }
  listInscripcionesMe(): Observable<Inscripcion[]> {
    return this.inscripciones.listInscripcionesMe();
  }
  listInscripcionesPorCurso(cursoId: string): Observable<Inscripcion[]> {
    return this.inscripciones.listInscripcionesPorCurso(cursoId);
  }
  /** Da de baja una matrícula: la propia si eres estudiante, cualquiera si eres admin. */
  deleteInscripcion(id: string): Observable<void> {
    return this.inscripciones.deleteInscripcion(id);
  }
}
