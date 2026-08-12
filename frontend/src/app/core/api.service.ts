// src/app/core/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';

import { Usuario }     from '../models/usuario.model';
import { Curso }       from '../models/curso.model';
import { Inscripcion } from '../models/inscripcion.model';
import { aCurso, aCursos, deCurso } from '../models/curso.mapper';

/** Tamaño de página por defecto y tope que aplica el backend. */
export const LIMITE_PAGINA = 20;
export const LIMITE_MAXIMO_PAGINA = 100;

/** Una página de resultados con lo que necesita un paginador. */
export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
}

/**
 * Normaliza la respuesta del backend a una Pagina.
 * Tolera que llegue un array pelado (sin metadatos), para no romper si algún
 * endpoint todavía no pagina.
 */
function aPagina<T>(respuesta: any, clave: string, pagina: number, limite: number): Pagina<T> {
  const items: T[] = Array.isArray(respuesta) ? respuesta : (respuesta?.[clave] ?? []);
  return {
    items,
    total  : respuesta?.total   ?? items.length,
    pagina : respuesta?.pagina  ?? pagina,
    limite : respuesta?.limite  ?? limite,
    paginas: respuesta?.paginas ?? 1
  };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = environment.apiBase;

  constructor(private http: HttpClient) {}

  // ---------------- AUTH ----------------
  login(body: { correo: string; password: string })
  : Observable<{ token: string; usuario: Usuario }> {
    const payload = { correo: body.correo, ['contraseña']: body.password };
    return this.http.post<{ token: string; usuario: Usuario }>(
      `${this.base}/auth/login`,
      payload
    ).pipe(
      // guarda token/usuario para el interceptor
      tap(res => {
        try {
          localStorage.setItem('token', res.token);
          localStorage.setItem('usuario', JSON.stringify(res.usuario));
        } catch {}
      })
    );
  }

  renew(): Observable<{ token: string; usuario: Usuario }> {
    return this.http.get<{ token: string; usuario: Usuario }>(
      `${this.base}/auth/renew`
    ).pipe(
      tap(res => {
        try {
          if (res?.token)   localStorage.setItem('token', res.token);
          if (res?.usuario) localStorage.setItem('usuario', JSON.stringify(res.usuario));
        } catch {}
      })
    );
  }

  register(body: { nombre: string; correo: string; password: string; rol?: 'estudiante'|'profesor'|'admin' })
  : Observable<{ ok: boolean; usuario: Usuario }> {
    const payload = {
      nombre: body.nombre,
      correo: body.correo,
      ['contraseña']: body.password,
      rol: body.rol ?? 'estudiante'
    };
    return this.http.post<{ ok: boolean; usuario: Usuario }>(
      `${this.base}/usuarios`,
      payload
    );
  }

  // ---------------- USUARIOS ----------------
  getUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.base}/usuarios`);
  }
  getUsuario(id: string): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.base}/usuarios/${id}`);
  }
  createUsuario(body: Partial<Usuario>): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.base}/usuarios`, body);
  }
  updateUsuario(
    id: string,
    // `contraseñaActual` es obligatoria cuando cambias TU propia contraseña.
    body: Partial<Usuario> & {
      profesorClave?: string;
      'contraseña'?: string;
      'contraseñaActual'?: string;
    }
  ): Observable<{ ok: boolean; usuario: Usuario }> {
    return this.http.put<{ ok: boolean; usuario: Usuario }>(
      `${this.base}/usuarios/${id}`,
      body
    );
  }
  deleteUsuario(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/usuarios/${id}`);
  }

  // ✅ tolerante ({ok, usuarios} o array)
  listUsuarios(): Observable<Usuario[]> {
    return this.listUsuariosPaginado().pipe(map(p => p.items));
  }

  /**
   * Igual que listUsuarios pero conservando los metadatos de paginación, que es
   * lo que necesita un paginador para saber cuántas páginas hay.
   */
  listUsuariosPaginado(pagina = 1, limite = LIMITE_PAGINA): Observable<Pagina<Usuario>> {
    const params = new HttpParams().set('page', pagina).set('limit', limite);
    return this.http
      .get<any>(`${this.base}/usuarios`, { params })
      .pipe(map(r => aPagina<Usuario>(r, 'usuarios', pagina, limite)));
  }

  /**
   * Usuarios de un rol concreto, para poblar desplegables.
   * Filtra en el servidor: traerse la tabla entera para quedarse con los
   * profesores es justo lo que la paginación viene a evitar.
   */
  listUsuariosPorRol(rol: 'estudiante' | 'profesor' | 'admin'): Observable<Usuario[]> {
    const params = new HttpParams()
      .set('rol', rol)
      .set('limit', LIMITE_MAXIMO_PAGINA);
    return this.http
      .get<any>(`${this.base}/usuarios`, { params })
      .pipe(map(r => aPagina<Usuario>(r, 'usuarios', 1, LIMITE_MAXIMO_PAGINA).items));
  }

  // ---------------- CURSOS ----------------
  // La traducción nombre↔titulo vive en models/curso.mapper.ts y solo ahí.
  getCursos(): Observable<Curso[]> {
    return this.http.get<any>(`${this.base}/cursos`).pipe(
      map(r => aCursos(Array.isArray(r) ? r : (r?.cursos ?? [])))
    );
  }

  // ⇨ tolerante a { ok, curso } | Curso
  getCurso(id: string): Observable<Curso> {
    return this.http.get<any>(`${this.base}/cursos/${id}`).pipe(map(aCurso));
  }

  createCurso(
    body: Partial<Curso> & { nombre?: string; descripcion?: string; profesor?: string | Usuario }
  ): Observable<Curso> {
    return this.http.post<any>(`${this.base}/cursos`, deCurso(body)).pipe(map(aCurso));
  }

  /**
   * El PUT del backend valida el curso completo, así que si la edición es
   * parcial hay que leerlo antes y completar los campos que falten.
   */
  updateCurso(id: string, body: Partial<Curso>): Observable<Curso> {
    const payload = deCurso(body);
    const completo = payload['nombre'] !== undefined && payload['descripcion'] !== undefined;

    const enviar = (base?: Curso) =>
      this.http.put<any>(`${this.base}/cursos/${id}`, { ...deCurso(base ?? {}), ...payload }, this.authOpts())
        .pipe(map(aCurso));

    return completo ? enviar() : this.getCurso(id).pipe(switchMap(enviar));
  }

  deleteCurso(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cursos/${id}`);
  }

  // ✅ listado tolerante
  //
  // Pide el máximo que permite el backend porque el catálogo del estudiante
  // filtra en cliente: si trajera solo la primera página, la búsqueda mentiría
  // sin decirlo. Con catálogos mayores hay que mover el filtro al servidor.
  listCursos(): Observable<Curso[]> {
    return this.listCursosPaginado(1, LIMITE_MAXIMO_PAGINA).pipe(map(p => p.items));
  }

  /** Igual que listCursos, conservando los metadatos de paginación. */
  listCursosPaginado(pagina = 1, limite = LIMITE_PAGINA): Observable<Pagina<Curso>> {
    const params = new HttpParams().set('page', pagina).set('limit', limite);
    return this.http
      .get<any>(`${this.base}/cursos`, { params })
      .pipe(map(r => {
        const p = aPagina<any>(r, 'cursos', pagina, limite);
        return { ...p, items: aCursos(p.items) };
      }));
  }

  /** Crea curso como admin (mismo endpoint, con cabecera de autorización). */
  createCursoAdmin(
    body: { titulo: string; descripcion: string; profesor?: string | Usuario }
  ): Observable<Curso> {
    return this.http
      .post<any>(`${this.base}/cursos`, deCurso(body), this.authOpts())
      .pipe(map(aCurso));
  }

  /**
   * Reasigna el profesor de un curso.
   * Lee el curso antes porque el PUT del backend valida el recurso completo.
   */
  asignarProfesor(cursoId: string, profesor: string | Usuario): Observable<Curso> {
    return this.getCurso(cursoId).pipe(
      switchMap(curso =>
        this.http.put<any>(
          `${this.base}/cursos/${cursoId}`,
          { ...deCurso(curso), ...deCurso({ profesor }) },
          this.authOpts()
        )
      ),
      map(aCurso)
    );
  }

  // ---------------- INSCRIPCIONES ----------------
  listInscripciones(): Observable<Inscripcion[]> {
    return this.http
      .get<any>(`${this.base}/inscripciones`)
      .pipe(map((r: any) => Array.isArray(r) ? r : (r?.inscripciones ?? r?.data ?? [])));
  }

  getInscripciones(): Observable<Inscripcion[]> {
    return this.listInscripciones();
  }

  createInscripcion(body: { curso: string; estudiante: string }): Observable<Inscripcion> {
    const payload = { cursoId: body.curso, estudianteId: body.estudiante };
    return this.http
      .post<{ ok: boolean; inscripcion: Inscripcion } | Inscripcion>(`${this.base}/inscripciones`, payload)
      .pipe(map((r: any) => r?.inscripcion ?? r));
  }

  cancelarInscripcion(id: string): Observable<Inscripcion> {
    return this.http.patch<Inscripcion>(`${this.base}/inscripciones/${id}/cancelar`, {});
  }

  enrollMe(cursoId: string): Observable<Inscripcion> {
    const me = this.getLocalUser();
    const estudianteId = this.idOf(me);
    if (!estudianteId) throw new Error('No hay usuario autenticado para matricular.');
    return this.createInscripcion({ curso: cursoId, estudiante: estudianteId });
  }

  // ---------------- Helpers por rol ----------------
  listInscripcionesMe(): Observable<Inscripcion[]> {
    const me = this.getLocalUser();
    const myId = this.idOf(me);
    return this.listInscripciones().pipe(
      map((all: Inscripcion[]) => (all || []).filter((i: any) => this.idOf(i?.estudiante) === myId))
    );
  }

  getMisInscripcionesDeEstudiante(_miUsuarioId?: string): Observable<Inscripcion[]> {
    return this.listInscripcionesMe();
  }

  getMisCursosComoProfesor(_miUsuarioId: string) {
    return this.listCursosDeProfesorMe();
  }

  getMisCursos(): Observable<(Curso & { progreso?: number })[]> {
    const me = this.getLocalUser();
    const myId = this.idOf(me);

    return forkJoin({
      cursos: this.listCursos(),
      ins   : this.listInscripciones()
    }).pipe(
      map(({ cursos, ins }) => {
        const mapCursos = new Map<string, Curso>();
        (cursos || []).forEach((c: any) => {
          const cid = this.idOf(c);
          if (cid) mapCursos.set(cid, c as Curso);
        });

        const mine = (ins || []).filter((i: any) => this.idOf(i?.estudiante) === myId);

        const result: (Curso & { progreso?: number })[] = [];
        for (const i of mine as any[]) {
          const cursoId = this.idOf(i?.curso) || (i?.cursoId as string | undefined);
          const cursoObj = cursoId ? mapCursos.get(cursoId) : undefined;
          if (cursoObj) result.push({ ...(cursoObj as Curso), progreso: i?.progreso as number | undefined });
        }
        return result;
      })
    );
  }

  listCursosDeProfesorMe(): Observable<Curso[]> {
    const me = this.getLocalUser();
    const myId = this.idOf(me);
    const myNameNorm = this.normalize((me?.nombre || '').toString());

    return this.listCursos().pipe(
      map((cs: Curso[]) => (cs || []).filter((c: any) => {
        const p = c?.profesor;
        const pid = this.idOf(p);
        if (pid && myId && String(pid) === String(myId)) return true;

        // fallback por compatibilidad con datos antiguos que tengan nombre
        const pname = typeof p === 'string' ? p : (p?.nombre || p?.name || '');
        if (pname && myNameNorm) {
          return this.normalize(String(pname)) === myNameNorm;
        }
        return false;
      }))
    );
  }

  listInscripcionesPorCurso(cursoId: string): Observable<Inscripcion[]> {
    return this.listInscripciones().pipe(
      map((ins: Inscripcion[]) => (ins || []).filter((i: any) => {
        const cid = this.idOf(i?.curso) || (i as any)?.cursoId;
        return String(cid) === String(cursoId);
      }))
    );
  }

  listEstudiantesPorCurso(cursoId: string): Observable<Usuario[]> {
    return forkJoin({
      inscripciones: this.listInscripcionesPorCurso(cursoId),
      usuarios: this.listUsuarios()
    }).pipe(
      map(({ inscripciones, usuarios }) => {
        const mapUsuarios = new Map<string, Usuario>();
        (usuarios || []).forEach((u: any) => {
          const uid = this.idOf(u);
          if (uid) mapUsuarios.set(uid, u as Usuario);
        });

        const res: Usuario[] = [];
        for (const i of inscripciones || []) {
          const estId = this.idOf((i as any).estudiante);
          const u = estId ? mapUsuarios.get(estId) : undefined;
          if (u) res.push(u);
        }
        const seen = new Set<string>();
        return res.filter(u => {
          const uid = this.idOf(u);
          if (!uid || seen.has(uid)) return false;
          seen.add(uid);
          return true;
        });
      })
    );
  }

  // ---------------- privados ----------------

  // DEPRECADO para cursos: ya no se usa para crear/asignar (conservado por si algo externo lo llama)
  private resolveProfesorNombre(prof?: string | Usuario): Observable<string> {
    if (!prof) return of('');
    if (typeof prof !== 'string') {
      const n = (prof as any)?.nombre || (prof as any)?.name || '';
      if (n) return of(String(n));
      const id = this.idOf(prof);
      if (!id) return of('');
      return this.getUsuario(id).pipe(map(u => String((u as any)?.nombre || (u as any)?.name || '')));
    }
    const maybeId = prof.trim();
    if (maybeId.length >= 12 && !maybeId.includes(' ')) {
      return this.getUsuario(maybeId).pipe(
        map(u => String((u as any)?.nombre || (u as any)?.name || ''))
      );
    }
    return of(maybeId);
  }

  private getLocalUser(): any | null {
    try { return JSON.parse(localStorage.getItem('usuario') || 'null'); }
    catch { return null; }
  }
  private idOf(x: any): string {
    if (!x) return '';
    if (typeof x === 'string') return x;
    return (x._id ?? x.id ?? x.uid ?? x._uid ?? '') as string;
  }
  private normalize(s: string): string {
    return (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
  private authOpts() {
    const token = localStorage.getItem('token') || '';
    const headers: Record<string,string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-token'] = token; // compat
    }
    return { headers: new HttpHeaders(headers) };
  }
}