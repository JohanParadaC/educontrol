// src/app/professor/professor-dashboard.component.ts
// -------------------------------------------------------------------
// Cambios claves:
// 1) forkJoin para cursos+inscripciones en paralelo (no anidar suscripciones).
// 2) KPIs: cursos activos y total de estudiantes.
// 3) UI: saludo + tarjetas como en dashboard de alumno.
// 4) Tolerancia a esquemas (titulo/nombre, id variables).
// 5) Enlace "Ver mis clases" -> /profesor/clases.
// 6) CAMBIO: se añade MatTooltipModule para usar matTooltip en la "chip".
// -------------------------------------------------------------------

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip'; // ✅ CAMBIO: tooltip

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { Curso } from '../models/curso.model';

@Component({
  standalone: true,
  selector: 'app-professor-dashboard',
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule, MatIconModule, MatButtonModule,
    MatDividerModule, MatProgressBarModule,
    MatTooltipModule // ✅ CAMBIO: necesario para matTooltip
  ],
  template: `
  <div class="wrap">
    <!-- ===== Cabecera con saludo + CTA ===== -->
    <div class="header">
      <div>
        <h1 class="title">Hola, {{ auth.usuario?.nombre || 'Profesor' }} 👋</h1>
        <div class="subtitle">Bienvenido a tu panel</div>
      </div>
      <!-- CAMBIO: el CTA te lleva a la lista /profesor/clases -->
      <a mat-stroked-button color="primary" [routerLink]="classesLink">
        <mat-icon>class</mat-icon>&nbsp;Ver mis clases
      </a>
    </div>

    <mat-divider></mat-divider>

    <!-- ===== KPIs ===== -->
    <div *ngIf="loading" class="mt-2">
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    </div>

    <div *ngIf="!loading">
      <div class="kpis" *ngIf="cursos.length; else noCursos">
        <div class="kpi">
          <div class="num">{{ cursos.length }}</div>
          <div class="lbl">Cursos activos</div>
        </div>
        <div class="kpi">
          <div class="num">{{ totalEstudiantes }}</div>
          <div class="lbl">Estudiantes inscritos</div>
        </div>
      </div>

      <!-- ===== Tus clases (tarjetas) ===== -->
      <h3 class="section">
        <mat-icon>menu_book</mat-icon>&nbsp;Tus clases
      </h3>

      <div class="cards" *ngIf="cursos.length; else noCursos">
        <mat-card class="course" *ngFor="let c of cursos; trackBy: trackById">
          <mat-card-title>{{ courseTitle(c) }}</mat-card-title>
          <mat-card-subtitle>{{ courseDesc(c) || '—' }}</mat-card-subtitle>

          <mat-card-content>
            <!-- CAMBIO: tooltip requiere MatTooltipModule -->
            <div class="chip" matTooltip="Total de alumnos inscritos">
              <mat-icon>group</mat-icon>
              {{ inscritosPorCurso.get(idOf(c)) || 0 }} estudiantes
            </div>
          </mat-card-content>

          <mat-card-actions>
            <!-- Si tienes detalle, cambia a: ['/curso', idOf(c)] -->
            <a mat-button color="primary" [routerLink]="classesLink">Ir al curso</a>
          </mat-card-actions>
        </mat-card>
      </div>

      <ng-template #noCursos>
        <div class="empty">
          <mat-icon>info</mat-icon>
          Aún no tienes cursos asignados.
        </div>
      </ng-template>
    </div>
  </div>
  `,
  styles: [`
    .wrap{ padding: 0 4px; }
    .header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .title{ margin:0; font-size: 40px; font-weight: 800; }
    .subtitle{ color: rgba(0,0,0,.6); margin-top: 4px; }
    .kpis{ display:flex; gap:16px; padding:12px 0; flex-wrap: wrap; }
    .kpi{ background:rgba(255,255,255,.04); border-radius:10px; padding:12px 16px; min-width:180px; }
    .kpi .num{ font-size:24px; font-weight:700; }
    .kpi .lbl{ opacity:.8; }
    .section{ display:flex; align-items:center; gap:6px; margin: 12px 0 8px; }
    .cards{ display:grid; grid-template-columns: repeat(auto-fill, minmax(320px,1fr)); gap:12px; }
    .course{ border-radius: 16px; }
    .chip{ display:inline-flex; align-items:center; gap:6px; padding:2px 8px; border-radius:999px; background:rgba(0,0,0,.06); }
    .empty{ opacity:.7; display:flex; align-items:center; gap:8px; padding:16px 0; }
    .mt-2{ margin-top:12px; }
    @media (max-width:900px){ .header a{ display:none } }
  `]
})
export class ProfessorDashboardComponent implements OnInit {
  // Servicios
  auth = inject(AuthService);
  private api = inject(ApiService);

  // Estado
  loading = false;
  cursos: Curso[] = [];
  inscritosPorCurso = new Map<string, number>();
  totalEstudiantes = 0;

  // CAMBIO: el CTA ahora apunta a la ruta de profesor
  classesLink = '/profesor/clases';

  ngOnInit(): void {
    this.cargar();
  }

  /** Carga cursos del profesor + inscripciones y calcula KPIs */
  private cargar(): void {
    this.loading = true;

    forkJoin({
      cursos: this.api.listCursosDeProfesorMe().pipe(catchError(() => of([] as Curso[]))),
      ins: this.api.listInscripciones().pipe(catchError(() => of([] as any[]))),
    }).subscribe({
      next: ({ cursos, ins }) => {
        this.cursos = cursos || [];

        // Map de cursoId -> conteo de alumnos
        this.inscritosPorCurso.clear();
        this.totalEstudiantes = 0;

        const idsCursos = new Set(this.cursos.map(c => this.idOf(c)));

        for (const i of ins || []) {
          const cursoId = this.idOf((i as any).curso) || (i as any).cursoId;
          if (!cursoId || !idsCursos.has(cursoId)) continue;

          const prev = this.inscritosPorCurso.get(cursoId) || 0;
          this.inscritosPorCurso.set(cursoId, prev + 1);
          this.totalEstudiantes++;
        }

        this.loading = false;
      },
      error: () => {
        this.cursos = [];
        this.inscritosPorCurso.clear();
        this.totalEstudiantes = 0;
        this.loading = false;
      }
    });
  }

  // === Helpers usados en el template ===

  /** Obtiene el ID de un objeto o string, tolerante a varios nombres */
  idOf(x: any): string {
    return typeof x === 'string' ? x : (x?._id ?? x?.id ?? x?.uid ?? x?._uid ?? '');
  }

  /** Título del curso (acepta nombre o titulo) */
  courseTitle(c: any): string {
    return c?.nombre || c?.titulo || '';
  }

  /** Descripción corta del curso (si existe) */
  courseDesc(c: any): string {
    return c?.descripcion || c?.descripcionCorta || c?.desc || '';
  }

  /** Optimiza *ngFor */
  trackById = (_: number, item: any) => this.idOf(item) || _;
}