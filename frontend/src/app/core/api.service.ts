import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';

import { Usuario }     from '../models/usuario.model';
import { Curso }       from '../models/curso.model';
import { Inscripcion } from '../models/inscripcion.model';

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
    body: Partial<Usuario> & { profesorClave?: string }
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
    return this.http
      .get<{ ok: boolean; usuarios: Usuario[] } | Usuario[]>(`${this.base}/usuarios`)
      .pipe(map((r: any) => Array.isArray(r) ? r : (r?.usuarios ?? [])));
  }

  // ---------------- CURSOS ----------------
  getCursos(): Observable<Curso[]> {
    return this.http.get<Curso[]>(`${this.base}/cursos`).pipe(
      map((cs: any[]) => (cs || []).map(c => ({ ...c, titulo: c?.titulo ?? c?.nombre } as Curso)))
    );
  }
  getCurso(id: string): Observable<Curso> {
    return this.http.get<Curso>(`${this.base}/cursos/${id}`).pipe(
      map((c: any) => ({ ...c, titulo: c?.titulo ?? c?.nombre } as Curso))
    );
  }

  createCurso(
    body: Partial<Curso> & { nombre?: string; titulo?: string; descripcion?: string }
  ): Observable<Curso> {
    const payload: any = { nombre: body.nombre ?? body.titulo, descripcion: body.descripcion };
    return this.http.post<Curso>(`${this.base}/cursos`, payload, this.authOpts()).pipe(
      map((c: any) => ({ ...c, titulo: c?.titulo ?? c?.nombre } as Curso))
    );
  }

  updateCurso(id: string, body: Partial<Curso>): Observable<Curso> {
    return this.http.put<Curso>(`${this.base}/cursos/${id}`, body, this.authOpts()).pipe(
      map((c: any) => ({ ...c, titulo: c?.titulo ?? c?.nombre } as Curso))
    );
  }
  deleteCurso(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cursos/${id}`, this.authOpts());
  }

  // ✅ listado tolerante
  listCursos(): Observable<Curso[]> {
    return this.http
      .get<{ ok: boolean; cursos: Curso[] } | Curso[]>(`${this.base}/cursos`)
      .pipe(
        map((r: any) => {
          const arr = Array.isArray(r) ? r : (r?.cursos ?? []);
          return (arr || []).map((c: any) => ({ ...c, titulo: c?.titulo ?? c?.nombre } as Curso));
        })
      );
  }

  createCursoAdmin(
    body: { titulo: string; descripcion: string; profesor?: string | Usuario }
  ): Observable<Curso> {
    const payload = { nombre: body.titulo, descripcion: body.descripcion };

    return this.http
      .post<{ ok: boolean; curso: Curso } | Curso>(`${this.base}/cursos`, payload, this.authOpts())
      .pipe(
        map((r: any) => r?.curso ?? r),
        switchMap((curso: any) => {
          const id = this.idOf(curso);
          const profesorId = body.profesor ? this.idOf(body.profesor as any) : '';

          if (id && profesorId) {
            return this.asignarProfesor(id, profesorId).pipe(
              catchError(err => {
                console.warn('No se pudo asignar profesor al curso recién creado:', err);
                return of(curso);
              })
            );
          }
          return of(curso);
        }),
        map((c: any) => ({ ...c, titulo: c?.titulo ?? c?.nombre } as Curso))
      );
  }

  asignarProfesor(cursoId: string, profesor: string | Usuario): Observable<Curso> {
    const pid = this.idOf(profesor as any);
    const url = `${this.base}/cursos/${cursoId}`;
    const norm = (r: any) => (r?.curso ?? r) as Curso;

    // 👉 Todos los intentos llevan authOpts() para adjuntar x-token incluso si fallara el interceptor
    return this.http.put(url, { profesor: pid }, this.authOpts()).pipe(
      map(norm),
      catchError(() => this.http.put(url, { profesorId: pid }, this.authOpts()).pipe(
        map(norm),
        catchError(() => this.http.patch(url, { profesor: pid }, this.authOpts()).pipe(
          map(norm),
          catchError(() => this.http.post(`${this.base}/cursos/${cursoId}/asignar-profesor`, { profesorId: pid }, this.authOpts()).pipe(
            map(norm),
            catchError(() => this.http.post(`${this.base}/cursos/asignar-profesor`, { cursoId, profesorId: pid }, this.authOpts()).pipe(
              map(norm)
            ))
          ))
        ))
      ))
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
      .post<{ ok: boolean; inscripcion: Inscripcion } | Inscripcion>(`${this.base}/inscripciones`, payload, this.authOpts())
      .pipe(map((r: any) => r?.inscripcion ?? r));
  }

  cancelarInscripcion(id: string): Observable<Inscripcion> {
    return this.http.patch<Inscripcion>(`${this.base}/inscripciones/${id}/cancelar`, {}, this.authOpts());
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

  // -----------------------------------------------------------------
  // Helpers para PROFESOR (dashboard/mis clases)
  // -----------------------------------------------------------------
  listCursosDeProfesorMe(): Observable<Curso[]> {
    const me = this.getLocalUser();
    const myId = this.idOf(me);
    const myNameNorm = this.normalize((me?.nombre || '').toString());

    return this.listCursos().pipe(
      map((cs: Curso[]) => (cs || []).filter((c: any) => {
        const p = c?.profesor;
        const pid = this.idOf(p);
        if (pid && myId && String(pid) === String(myId)) return true;

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

  /** Añade x-token + Authorization leyendo localStorage (por si fallara el interceptor) */
  private authOpts(): { headers?: HttpHeaders } {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('jwt') || '';
      if (!token) return {};
      return {
        headers: new HttpHeaders({
          'x-token': token,
          'Authorization': `Bearer ${token}`
        })
      };
    } catch {
      return {};
    }
  }
}