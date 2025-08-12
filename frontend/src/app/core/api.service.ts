import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

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
    // ✅ backend espera 'contraseña'
    const payload = { correo: body.correo, ['contraseña']: body.password };
    return this.http.post<{ token: string; usuario: Usuario }>(
      `${this.base}/auth/login`,
      payload
    );
  }

  renew(): Observable<{ token: string; usuario: Usuario }> {
    return this.http.get<{ token: string; usuario: Usuario }>(
      `${this.base}/auth/renew`
    );
  }

  register(body: { nombre: string; correo: string; password: string; rol?: 'estudiante'|'profesor'|'admin' })
  : Observable<{ ok: boolean; usuario: Usuario }> {
    const payload = {
      nombre: body.nombre,
      correo: body.correo,
      ['contraseña']: body.password, // ✅
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

  // ✅ tolerante: {ok, usuarios} o array
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

  /** Crear curso genérico: si viene 'titulo', lo mapeamos a 'nombre' (backend) */
  createCurso(
    body: Partial<Curso> & { nombre?: string; titulo?: string; descripcion?: string }
  ): Observable<Curso> {
    const payload: any = {
      nombre: body.nombre ?? body.titulo, // 👈 mapeo
      descripcion: body.descripcion
    };
    return this.http.post<Curso>(`${this.base}/cursos`, payload).pipe(
      map((c: any) => ({ ...c, titulo: c?.titulo ?? c?.nombre } as Curso))
    );
  }

  updateCurso(id: string, body: Partial<Curso>): Observable<Curso> {
    return this.http.put<Curso>(`${this.base}/cursos/${id}`, body).pipe(
      map((c: any) => ({ ...c, titulo: c?.titulo ?? c?.nombre } as Curso))
    );
  }
  deleteCurso(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cursos/${id}`);
  }

  // ✅ versiones mapeadas para admin/listado general
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

  /**
   * Admin crea cursos.
   * - Envía { nombre, descripcion } (no 'titulo').
   * - Si se pasa 'profesor', intenta reasignarlo con PUT.
   * - Si el PUT falla (400/403/etc), NO rompe el flujo: devolvemos el curso creado igual.
   */
  createCursoAdmin(
    body: { titulo: string; descripcion: string; profesor?: string | Usuario }
  ): Observable<Curso> {
    const payload = { nombre: body.titulo, descripcion: body.descripcion };

    return this.http
      .post<{ ok: boolean; curso: Curso } | Curso>(`${this.base}/cursos`, payload)
      .pipe(
        map((r: any) => r?.curso ?? r),
        switchMap((curso: any) => {
          const id = this.idOf(curso);
          const profesorId = body.profesor ? this.idOf(body.profesor as any) : '';

          if (id && profesorId) {
            return this.http
              .put<{ ok: boolean; curso: Curso } | Curso>(`${this.base}/cursos/${id}`, { profesor: profesorId })
              .pipe(
                map((r: any) => r?.curso ?? r),
                // 👇 No fallar si la reasignación responde 400/403/etc.
                catchError((err) => {
                  console.warn('No se pudo asignar profesor al curso recién creado:', err);
                  return of(curso);
                })
              );
          }
          return of(curso);
        }),
        // Normalizamos 'titulo' para el front
        map((c: any) => ({ ...c, titulo: c?.titulo ?? c?.nombre } as Curso))
      );
  }

  /** Reasignar profesor manualmente (sección "Asignar profesor") */
  asignarProfesor(cursoId: string, profesorId: string | Usuario): Observable<Curso> {
    const pid = this.idOf(profesorId as any);
    return this.http
      .put<{ ok: boolean; curso: Curso } | Curso>(`${this.base}/cursos/${cursoId}`, { profesor: pid })
      .pipe(map((r: any) => (r?.curso ?? r) as Curso));
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

  /** Crea inscripción: backend espera { cursoId, estudianteId } */
  createInscripcion(body: { curso: string; estudiante: string }): Observable<Inscripcion> {
    const payload = { cursoId: body.curso, estudianteId: body.estudiante };
    return this.http
      .post<{ ok: boolean; inscripcion: Inscripcion } | Inscripcion>(`${this.base}/inscripciones`, payload)
      .pipe(map((r: any) => r?.inscripcion ?? r));
  }

  cancelarInscripcion(id: string): Observable<Inscripcion> {
    return this.http.patch<Inscripcion>(`${this.base}/inscripciones/${id}/cancelar`, {});
  }

  /** ✅ Auto-matricular al usuario actual en un curso */
  enrollMe(cursoId: string): Observable<Inscripcion> {
    const me = this.getLocalUser();
    const estudianteId = this.idOf(me);
    if (!estudianteId) {
      throw new Error('No hay usuario autenticado para matricular.');
    }
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

  // --- Mis cursos como profesor (compat) ---
  getMisCursosComoProfesor(_miUsuarioId: string) {
    return this.listCursosDeProfesorMe();
  }

  /** 🧩 Mis cursos (unión inscripciones + cursos) */
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
        // 1) por ID
        const pid = this.idOf(p);
        if (pid && myId && String(pid) === String(myId)) return true;

        // 2) por nombre (si viene string)
        const pname = typeof p === 'string' ? p : (p?.nombre || p?.name || '');
        if (pname && myNameNorm) {
          return this.normalize(String(pname)) === myNameNorm;
        }
        return false;
      }))
    );
  }

  /** Inscripciones filtradas por curso */
  listInscripcionesPorCurso(cursoId: string): Observable<Inscripcion[]> {
    return this.listInscripciones().pipe(
      map((ins: Inscripcion[]) => (ins || []).filter((i: any) => {
        const cid = this.idOf(i?.curso) || (i as any)?.cursoId;
        return String(cid) === String(cursoId);
      }))
    );
  }

  /** Estudiantes (Usuario[]) inscritos a un curso. */
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
        // quitar duplicados por id
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
  /** 🔑 Devuelve ID tolerante (_id | id | uid | string) */
  private idOf(x: any): string {
    if (!x) return '';
    if (typeof x === 'string') return x;
    return (x._id ?? x.id ?? x.uid ?? x._uid ?? '') as string;
  }
  /** 🔤 Normaliza para comparar nombres sin acentos / case-insensitive */
  private normalize(s: string): string {
    return (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}