// src/app/mis-clases/mis-clases.component.ts
// -------------------------------------------------------------
// FIX:
// 1) Reemplaza toPromise() por forkJoin (RxJS).
// 2) Soporta múltiples formas de respuesta: array directo o {data}/ {cursos}/ {results}.
// 3) Detecta el profesor del curso por id (profesor/profesorId/idProfesor/docente*/teacher*)
//    o por nombre (cuando backend guarda sólo el nombre).
// 4) Maneja loading y errores; agrega console.debug para inspección rápida.
// -------------------------------------------------------------

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MaterialModule } from '../shared/material.module';
import { AuthService } from '../core/auth.service';

interface Curso {
  _id: string;
  nombre: string;
  profesor?: any;           // puede ser string, objeto, o inexistente
  profesorId?: string;
  idProfesor?: string;
  docente?: any;
  docenteId?: string;
  teacher?: any;
  teacherId?: string;
}
interface Usuario {
  _id?: string; id?: string; uid?: string; _uid?: string;
  nombre?: string; name?: string;
}
interface Inscripcion {
  _id: string;
  curso: string | { _id?: string; id?: string };
  estudiante: string | { _id?: string; id?: string };
}

@Component({
  standalone: true,
  selector: 'app-mis-clases',
  templateUrl: './mis-clases.component.html',
  styleUrls: ['./mis-clases.component.scss'],
  imports: [CommonModule, HttpClientModule, MaterialModule]
})
export class MisClasesComponent implements OnInit {
  misCursos: Curso[] = [];
  inscripciones: Inscripcion[] = [];
  usuariosMap = new Map<string, Usuario>();

  loading = false;
  errorMsg = '';

  constructor(
    private http: HttpClient,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    const yo = this.auth.usuario;
    if (!yo) return;

    this.loading = true;
    this.errorMsg = '';

    // Pedimos todo en paralelo
    forkJoin({
      cursos: this.http.get<any>('/api/cursos').pipe(catchError(err => this.onHttpError('cursos', err))),
      inscripciones: this.http.get<any>('/api/inscripciones').pipe(catchError(err => this.onHttpError('inscripciones', err))),
      usuarios: this.http.get<any>('/api/usuarios').pipe(catchError(err => this.onHttpError('usuarios', err))),
    }).subscribe({
      next: ({ cursos, inscripciones, usuarios }) => {
        const cursosArr = this.unwrapArray<Curso>(cursos, ['cursos', 'items', 'rows']);
        const inscArr   = this.unwrapArray<Inscripcion>(inscripciones, ['inscripciones', 'items', 'rows']);
        const usersArr  = this.unwrapArray<Usuario>(usuarios, ['usuarios', 'items', 'rows']);

        // Logs para depurar rápidamente en DevTools
        console.debug('[MisClases] cursos:', cursosArr);
        console.debug('[MisClases] inscripciones:', inscArr);
        console.debug('[MisClases] usuarios:', usersArr);

        // Mapeo de usuarios por id
        usersArr.forEach(u => {
          const id = this.idOf(u);
          if (id) this.usuariosMap.set(String(id), u);
        });

        // Identidad del profesor logueado
        const myId = this.idOf(yo);
        const myName = this.normalize(yo?.nombre || '');

        // Filtramos cursos "míos"
        this.misCursos = cursosArr.filter(c => {
          const pid = this.profIdFromCourse(c);
          if (pid && myId && String(pid) === String(myId)) return true;

          const pname = this.profNameFromCourse(c);
          return pname ? this.normalize(pname) === myName : false;
        });

        this.inscripciones = inscArr;
        this.loading = false;
      },
      error: () => {
        // onHttpError ya setea errorMsg, aquí solo finalizamos loading
        this.loading = false;
      }
    });
  }

  // === Helpers de negocio ===

  alumnosDeCurso(cursoId: string): Usuario[] {
    const ids = (this.inscripciones || [])
      .filter(i => String(this.idOf(i.curso)) === String(cursoId))
      .map(i => this.idOf(i.estudiante))
      .filter((x): x is string => !!x);

    const uniq = Array.from(new Set(ids.map(String)));
    return uniq.map(id => this.usuariosMap.get(id)).filter((u): u is Usuario => !!u);
  }

  // === Helpers genéricos ===

  /** Intenta extraer un array ya sea si llega como array directo o envuelto en { data } o en alguna key alternativa */
  private unwrapArray<T = any>(payload: any, altKeys: string[] = []): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (Array.isArray(payload?.data)) return payload.data as T[];
    for (const k of altKeys) {
      if (Array.isArray(payload?.[k])) return payload[k] as T[];
    }
    // Si el backend paginó como { data: { docs: [] } }
    if (Array.isArray(payload?.data?.docs)) return payload.data.docs as T[];
    return [];
  }

  /** Obtiene un id de string u objeto con varias posibilidades */
  private idOf(entity: any): string | null {
    if (!entity) return null;
    if (typeof entity === 'string') return entity;
    return entity._id || entity.id || entity.uid || entity._uid || null;
  }

  /** Normaliza texto para comparar nombres (minúsculas y sin acentos) */
  private normalize(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /** Extrae el id del profesor del curso, probando varios campos comunes */
  private profIdFromCourse(c: any): string | null {
    const candidates = [
      this.idOf(c?.profesor),
      c?.profesorId,
      c?.idProfesor,
      this.idOf(c?.docente),
      c?.docenteId,
      this.idOf(c?.teacher),
      c?.teacherId,
    ];
    for (const v of candidates) {
      if (v) return String(v);
    }
    return null;
  }

  /** Extrae el nombre del profesor del curso (cuando viene nombre en vez de id) */
  private profNameFromCourse(c: any): string {
    if (typeof c?.profesor === 'string') return c.profesor;
    return c?.profesorNombre || c?.profesor?.nombre || c?.profesor?.name || c?.docente?.nombre || c?.teacher?.name || '';
  }

  /** Manejo de errores HTTP con mensaje y log */
  private onHttpError(tag: string, err: any) {
    console.error(`[MisClases] error cargando ${tag}:`, err);
    const status = err?.status;
    if (status === 401 || status === 403) {
      this.errorMsg = 'No autorizado. Verifica tu sesión (token).';
    } else {
      this.errorMsg = `No se pudo cargar ${tag}.`;
    }
    // devolvemos array vacío para que forkJoin complete
    return of([]);
  }

  // Útil si usas *ngFor con trackBy
  trackById = (_: number, item: { _id?: string; id?: string }) => (item?._id || item?.id || _);
}