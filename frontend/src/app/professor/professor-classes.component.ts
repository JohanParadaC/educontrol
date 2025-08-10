// src/app/professor/professor-classes.component.ts
// -------------------------------------------------------------------
// Qué cambia:
// 1) Cargamos en paralelo cursos del profesor + usuarios + inscripciones.
// 2) Construimos Map<cursoId, Usuario[]> cruzando inscripciones con usuarios.
// 3) Toleramos distintos nombres de campos del backend:
//    - curso:  curso | cursoId | clase | idCurso
//    - alumno: estudiante | estudianteId | alumno | alumnoId | usuario | usuarioId | user | userId
//    - ids:    _id | id | uid | _uid
// 4) Fallbacks:
//    - Si /api/inscripciones viene vacío, intentamos por curso:
//      * ApiService.listEstudiantesPorCurso(cursoId) (si existe)
//      * y como plan C, llamamos con HttpClient a endpoints típicos:
//        /api/inscripciones?curso=ID, ?cursoId=ID, ?clase=ID,
//        /api/cursos/ID/estudiantes, /api/cursos/ID/inscripciones, etc.
// 5) Si la inscripción viene “populada” (estudiante ya es objeto), la usamos directo.
// -------------------------------------------------------------------

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { HttpClient, HttpClientModule } from '@angular/common/http';

import { forkJoin, of, concat } from 'rxjs';
import { catchError, map, filter, take, defaultIfEmpty } from 'rxjs/operators';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Curso } from '../models/curso.model';
import { Usuario } from '../models/usuario.model';

@Component({
  standalone: true,
  selector: 'app-professor-classes',
  imports: [
    CommonModule,
    HttpClientModule, // ✅ para fallbacks con HttpClient
    MatCardModule, MatIconModule, MatButtonModule, MatDividerModule,
    MatProgressBarModule, MatTableModule
  ],
  template: `
  <div class="wrap">

    <mat-card class="brand">
      <div class="brand-wrap">
        <div>
          <h1>Mis clases</h1>
          <span *ngIf="auth.usuario?.nombre">Profesor: {{ auth.usuario?.nombre }}</span>
        </div>
      </div>
    </mat-card>

    <ng-container *ngIf="loading; else loaded">
      <mat-card><mat-progress-bar mode="indeterminate"></mat-progress-bar></mat-card>
    </ng-container>

    <ng-template #loaded>
      <ng-container *ngIf="cursos.length; else empty">
        <div class="cards">
          <mat-card class="course" *ngFor="let c of cursos; trackBy: trackCurso">
            <!-- Título/desc tolerantes (nombre|titulo, descripcion|desc) -->
            <mat-card-title>{{ courseTitle(c) }}</mat-card-title>
            <mat-card-subtitle>{{ courseDesc(c) || '—' }}</mat-card-subtitle>

            <mat-divider></mat-divider>

            <!-- Tabla con estudiantes inscritos -->
            <div *ngIf="(alumnos.get(idOf(c)) || []).length; else noAlumnos" class="table-wrap">
              <table mat-table [dataSource]="alumnos.get(idOf(c))!">
                <ng-container matColumnDef="nombre">
                  <th mat-header-cell *matHeaderCellDef>Nombre</th>
                  <td mat-cell *matCellDef="let e">{{ e.nombre || e.name }}</td>
                </ng-container>

                <ng-container matColumnDef="correo">
                  <th mat-header-cell *matHeaderCellDef>Correo</th>
                  <td mat-cell *matCellDef="let e">{{ e.correo || e.email }}</td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="cols"></tr>
                <tr mat-row *matRowDef="let row; columns: cols;"></tr>
              </table>
            </div>

            <ng-template #noAlumnos>
              <div class="empty">
                <mat-icon>info</mat-icon>
                Aún no hay estudiantes inscritos.
              </div>
            </ng-template>
          </mat-card>
        </div>
      </ng-container>

      <ng-template #empty>
        <mat-card>
          <div class="empty"><mat-icon>info</mat-icon> No tienes cursos asignados todavía.</div>
        </mat-card>
      </ng-template>
    </ng-template>

  </div>
  `,
  styles: [`
    .wrap{ display:grid; gap:16px; padding:0 4px }
    .brand .brand-wrap{ display:flex; align-items:center; justify-content:space-between }
    .brand h1{ margin:0 }
    .cards{ display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px }
    .course{ min-height:140px; border-radius: 16px; }
    .table-wrap{ overflow:auto; margin-top:8px }
    table{ width:100% }
    .empty{ opacity:.7; display:flex; align-items:center; gap:8px; padding:6px 0 }
  `]
})
export class ProfessorClassesComponent implements OnInit {
  private api  = inject(ApiService);
  private http = inject(HttpClient);
  public auth  = inject(AuthService);

  loading = false;
  cursos: Curso[] = [];
  alumnos = new Map<string, Usuario[]>(); // cursoId -> lista de alumnos
  cols = ['nombre','correo'];

  ngOnInit(): void {
    this.cargar();
  }

  /** Carga cursos del profe + usuarios + inscripciones y arma el mapa de alumnos por curso */
  private cargar(): void {
    this.loading = true;

    forkJoin({
      cursos   : this.api.listCursosDeProfesorMe().pipe(catchError(() => of([] as any))),
      usuarios : this.api.getUsuarios().pipe(catchError(() => of([] as any))),
      ins      : this.api.listInscripciones().pipe(catchError(() => of([] as any))),
    }).subscribe({
      next: ({ cursos, usuarios, ins }) => {
        const cursosArr   = this.unwrapArray<Curso>(cursos,   ['cursos','items','rows']);
        const usuariosArr = this.unwrapArray<Usuario>(usuarios,['usuarios','items','rows']);
        const insArr      = this.unwrapArray<any>(ins,        ['inscripciones','items','rows']);

        this.cursos = cursosArr || [];

        // Indexamos usuarios por id para lookups rápidos
        const usuariosMap = new Map<string, Usuario>();
        for (const u of usuariosArr || []) {
          const id = this.idOf(u);
          if (id) usuariosMap.set(String(id), u);
        }

        // ✅ Caso A: tenemos inscripciones globales
        if ((insArr || []).length > 0) {
          this.alumnos = this.buildAlumnosMapFromIns(insArr, usuariosMap);
          this.loading = false;
          return;
        }

        // 🔁 Caso B: no hay inscripciones globales → intentar por curso
        const calls = (this.cursos || []).map(c => this.getInscripcionesPorCursoSmart(this.idOf(c)));

        if (!calls.length) {
          this.alumnos.clear();
          this.loading = false;
          return;
        }

        forkJoin(calls).subscribe({
          next: grupos => {
            const insAll = grupos.flat();
            this.alumnos = this.buildAlumnosMapFromIns(insAll, usuariosMap);
            this.loading = false;
          },
          error: () => { this.loading = false; }
        });
      },
      error: () => { this.loading = false; }
    });
  }

  // ====== Fallback inteligente por curso ======
  /** Usa ApiService.listEstudiantesPorCurso si existe, si no prueba varias rutas/params típicos */
  private getInscripcionesPorCursoSmart(cursoId: string | null) {
    if (!cursoId) return of([] as any[]);
    const id = encodeURIComponent(cursoId);

    // 1) Si tu ApiService ya expone listEstudiantesPorCurso, úsalo
    const apiFn = (this.api as any).listEstudiantesPorCurso as
      | ((cid: string) => any) | undefined;

    if (apiFn) {
      return apiFn.call(this.api, cursoId).pipe(
        catchError(() => of([])),
        map((arr: any) => this.unwrapArray<any>(arr, ['usuarios','items','rows','inscripciones','data']))
      );
    }

    // 2) Plan C: probar endpoints comúnmente usados en backends Express/Mongoose
    const urls = [
      `/api/inscripciones?curso=${id}`,
      `/api/inscripciones?cursoId=${id}`,
      `/api/inscripciones?clase=${id}`,
      `/api/inscripciones?idCurso=${id}`,
      `/api/cursos/${id}/inscripciones`,
      `/api/cursos/${id}/estudiantes`,
      `/api/matriculas?curso=${id}`
    ];

    const reqs = urls.map(u =>
      this.http.get<any>(u).pipe(
        catchError(() => of(null)),
        map(payload => this.unwrapArray<any>(payload, ['inscripciones','items','rows','matriculas','data']))
      )
    );

    // devolvemos la PRIMERA respuesta no vacía; si todas vacías -> []
    return concat(...reqs).pipe(
      filter(arr => Array.isArray(arr) && arr.length > 0),
      take(1),
      defaultIfEmpty([] as any[])
    );
  }

  // ===== Helpers: extracción/normalización =====

  /** Extrae arrays desde [], {data}, {items}, {rows}, {data:{docs:[]}} */
  private unwrapArray<T = any>(payload: any, altKeys: string[] = []): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (Array.isArray(payload?.data)) return payload.data as T[];
    for (const k of altKeys) {
      if (Array.isArray(payload?.[k])) return payload[k] as T[];
    }
    if (Array.isArray(payload?.data?.docs)) return payload.data.docs as T[];
    return [];
  }

  /** Obtiene id robusto de un objeto o string */
  idOf(x:any){ return typeof x==='string' ? x : (x?._id ?? x?.id ?? x?.uid ?? x?._uid ?? ''); }

  /** Del payload de inscripción, saca el id de curso (curso|cursoId|clase|idCurso) */
  private courseIdFromIns(i:any): string | null {
    return this.idOf(i?.curso) ?? i?.cursoId ?? this.idOf(i?.clase) ?? i?.idCurso ?? null;
  }

  /** Del payload de inscripción, saca el id de estudiante (estudiante|alumno|usuario|user…) */
  private studentIdFromIns(i:any): string | null {
    return this.idOf(i?.estudiante)
        ?? i?.estudianteId
        ?? this.idOf(i?.alumno)
        ?? i?.alumnoId
        ?? this.idOf(i?.usuario)
        ?? i?.usuarioId
        ?? this.idOf(i?.user)
        ?? i?.userId
        ?? null;
  }

  /** Si la inscripción ya viene “populada” (estudiante como objeto), úsala directo */
  private studentObjFromIns(i:any): Usuario | null {
    const o = i?.estudiante ?? i?.alumno ?? i?.usuario ?? i?.user ?? null;
    return (o && typeof o === 'object') ? (o as Usuario) : null;
  }

  /** Construye Map<cursoId, Usuario[]> desde inscripciones + usuariosMap */
  private buildAlumnosMapFromIns(ins:any[], usuariosMap: Map<string, Usuario>): Map<string, Usuario[]> {
    const res = new Map<string, Usuario[]>();
    for (const i of ins || []) {
      const cid = this.courseIdFromIns(i);
      if (!cid) continue;

      // preferimos el objeto populado si viene
      const obj = this.studentObjFromIns(i);
      let user: Usuario | undefined;

      if (obj) {
        user = obj;
      } else {
        const uid = this.studentIdFromIns(i);
        if (!uid) continue;
        user = usuariosMap.get(String(uid));
      }

      if (!user) continue;

      const list = res.get(String(cid)) || [];
      if (!list.some(u => this.idOf(u) === this.idOf(user))) list.push(user); // evitar duplicados
      res.set(String(cid), list);
    }
    return res;
  }

  // ===== Helpers de plantilla =====

  courseTitle(c:any){ return c?.nombre || c?.titulo || ''; }
  courseDesc (c:any){ return c?.descripcion || c?.desc || c?.descripcionCorta || ''; }

  trackCurso = (_:number, c:Curso) => this.idOf(c);
}