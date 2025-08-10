// src/app/student/student-dashboard.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Curso } from '../models/curso.model';

/** Estructura mínima de una inscripción (por si el backend devuelve inscripciones) */
type Inscripcion = {
  _id: string;
  curso?: string | Curso;
  cursoId?: string;
  estudiante?: any;
  progreso?: number;
  promedio?: number;
  estado?: string;
  createdAt?: string;
};

type CursoCard = Curso & { progreso?: number };

@Component({
  standalone: true,
  selector: 'app-student-dashboard',
  imports: [
    CommonModule, RouterModule,
    MatCardModule, MatIconModule, MatButtonModule,
    MatProgressBarModule, MatDividerModule, MatSnackBarModule
  ],
  template: `
  <div class="wrap">
    <!-- Cabecera -->
    <mat-card class="brand">
      <div class="brand-wrap">
        <div>
          <h1>Hola{{ auth.usuario?.nombre ? ', ' + auth.usuario?.nombre : '' }} 👋</h1>
          <span>Bienvenido a tu panel</span>
        </div>
        <div class="actions">
          <a mat-stroked-button color="primary" routerLink="/cursos">
            <mat-icon>school</mat-icon> Ver cursos
          </a>
        </div>
      </div>
    </mat-card>

    <!-- 1) Tus cursos -->
    <mat-card>
      <h3 class="card-title"><mat-icon>playlist_add_check</mat-icon> Tus cursos</h3>

      <ng-container *ngIf="loadingIns; else insLoaded">
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </ng-container>

      <ng-template #insLoaded>
        <ng-container *ngIf="misCursosCards.length; else emptyMis">
          <div class="cards-grid">
            <mat-card class="course" *ngFor="let c of misCursosCards; trackBy: trackCurso">
              <mat-card-title>{{ c.titulo }}</mat-card-title>
              <mat-card-subtitle>{{ profName(c.profesor) || '—' }}</mat-card-subtitle>
              <mat-card-content>
                <p class="desc" *ngIf="c.descripcion">{{ c.descripcion }}</p>
                <div class="progress" *ngIf="c.progreso != null">
                  <mat-progress-bar [value]="c.progreso" mode="determinate"></mat-progress-bar>
                  <span>{{ c.progreso }}%</span>
                </div>
              </mat-card-content>
              <mat-card-actions>
                <a mat-button routerLink="/cursos">Ir al curso</a>
              </mat-card-actions>
            </mat-card>
          </div>
        </ng-container>

        <ng-template #emptyMis>
          <div class="empty">
            <mat-icon>info</mat-icon>
            Aún no estás matriculado en ningún curso.
            <a routerLink="/cursos">Explora el catálogo</a>
          </div>
        </ng-template>
      </ng-template>
    </mat-card>

    <!-- 2) Cursos disponibles (SOLO los que NO estás matriculado) -->
    <mat-card>
      <h3 class="card-title"><mat-icon>library_books</mat-icon> Cursos disponibles</h3>

      <ng-container *ngIf="loadingCursos; else cursosLoaded">
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </ng-container>

      <ng-template #cursosLoaded>
        <ng-container *ngIf="cursosDisponibles.length; else emptyCursos">
          <div class="cards-grid">
            <mat-card class="course" *ngFor="let c of cursosDisponibles | slice:0:6; trackBy: trackCurso">
              <mat-card-title>{{ c.titulo }}</mat-card-title>
              <mat-card-subtitle>{{ profName(c.profesor) || '—' }}</mat-card-subtitle>
              <mat-card-content>
                <p class="desc" *ngIf="c.descripcion">{{ c.descripcion }}</p>
              </mat-card-content>
              <mat-card-actions>
                <!-- ✅ Matricular desde el dashboard (sin navegar) -->
                <button
                  mat-stroked-button
                  color="primary"
                  (click)="matricular(c)"
                  [disabled]="matriculandoId === idOf(c)">
                  {{ matriculandoId === idOf(c) ? 'Matriculando…' : 'Matricular' }}
                </button>
              </mat-card-actions>
            </mat-card>
          </div>
          <a mat-button color="primary" routerLink="/cursos">Ver todos</a>
        </ng-container>

        <ng-template #emptyCursos>
          <div class="empty">
            <mat-icon>info</mat-icon>
            No hay cursos publicados (o ya estás matriculado en todos).
          </div>
        </ng-template>
      </ng-template>
    </mat-card>
  </div>
  `,
  styles: [`
    .wrap { display: grid; gap: 16px; padding: 0 4px; }
    .brand .brand-wrap { display:flex; align-items:center; justify-content:space-between }
    .brand h1 { margin:0 }
    .actions a { margin-left:8px }
    .card-title { display:flex; align-items:center; gap:6px; margin:0 0 8px }
    .cards-grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .course { min-height: 140px; }
    .desc { margin: .25rem 0 .5rem; opacity: .9; }
    .progress{ display:flex; align-items:center; gap:8px; }
    .progress mat-progress-bar{ flex:1; }
    .empty { opacity:.7; display:flex; align-items:center; gap:8px }
    @media (max-width: 900px){ .actions{ display:none; } }
  `]
})
export class StudentDashboardComponent implements OnInit {
  private api = inject(ApiService) as any;
  public auth = inject(AuthService);
  private snack = inject(MatSnackBar);

  cursos: Curso[] = [];                 // Catálogo completo
  cursosDisponibles: Curso[] = [];      // Catálogo – matriculados
  misCursosCards: CursoCard[] = [];     // Mis cursos listos para card

  loadingCursos = false;
  loadingIns = false;
  matriculandoId: string | null = null; // Controla “Matriculando…”

  ngOnInit() { this.loadData(); }

  /** ------------------- Carga de datos ------------------- */
  private loadData(): void {
    this.loadingCursos = true;
    this.loadingIns = true;

    const cursos$    = this.getCursos$().pipe(catchError(() => of<Curso[]>([])));
    const misCursos$ = this.getMyCoursesOrInscripciones$().pipe(catchError(() => of<any[]>([])));

    forkJoin({ cursos: cursos$, mine: misCursos$ })
      .pipe(finalize(() => { this.loadingCursos = false; this.loadingIns = false; }))
      .subscribe(({ cursos, mine }) => {
        this.cursos = cursos || [];

        // 1) endpoint devuelve cursos directos
        if (this.looksLikeCursoArray(mine)) {
          this.misCursosCards = (mine as Curso[]).map(c => ({ ...(c as Curso) }));
        } else {
          // 2) vino como inscripciones → hidratar
          const mapCursos = new Map<string, Curso>();
          for (const c of this.cursos) {
            const id = this.idOf(c);
            if (id) mapCursos.set(id, c);
          }

          const inscripciones: Inscripcion[] = (mine || []) as Inscripcion[];
          const cards: CursoCard[] = [];
          for (const i of inscripciones) {
            const id = this.idOf(i.curso) || i.cursoId;
            const cursoObj = id ? mapCursos.get(id) : undefined;
            if (cursoObj) cards.push({ ...(cursoObj as Curso), progreso: i.progreso });
          }
          this.misCursosCards = cards;
        }

        // Cursos disponibles = catálogo – matriculados
        const enrolledIds = new Set<string>(this.misCursosCards.map(c => this.idOf(c)));
        this.cursosDisponibles = (this.cursos || []).filter(c => !enrolledIds.has(this.idOf(c)));
      });
  }

  /** ✅ Matricular desde el dashboard y actualizar tarjetas al vuelo */
  matricular(curso: Curso): void {
    const cursoId = this.idOf(curso);
    if (!cursoId) return;

    this.matriculandoId = cursoId;
    (this.api.enrollMe?.(cursoId) as Observable<any>)
      .pipe(finalize(() => this.matriculandoId = null))
      .subscribe({
        next: () => {
          // mover a “Tus cursos” y quitar de “Disponibles”
          this.misCursosCards = [{ ...(curso as Curso) }, ...this.misCursosCards];
          this.cursosDisponibles = this.cursosDisponibles.filter(c => this.idOf(c) !== cursoId);
          this.snack.open('¡Matriculado con éxito!', 'OK', { duration: 2500 });
        },
        error: (err) => {
          const msg = err?.error?.msg || err?.message || 'No se pudo matricular';
          this.snack.open(msg, 'Cerrar', { duration: 3500 });
        }
      });
  }

  /** Trae catálogo con el nombre disponible */
  private getCursos$(): Observable<Curso[]> {
    const api: any = this.api;
    return api.listCursos?.() ?? api.getCursos?.() ?? of<Curso[]>([]);
  }

  /** Intenta “mis cursos”; si no hay, usa inscripciones; si no, filtra todas */
  private getMyCoursesOrInscripciones$(): Observable<Curso[] | Inscripcion[]> {
    const api: any = this.api;

    const directCourseFns = [
      'getMisCursos','obtenerMisCursos','getCursosMatriculados',
      'getCursosInscrito','myCourses'
    ];
    for (const fn of directCourseFns) {
      if (typeof api[fn] === 'function') return api[fn]();
    }

    const myEnrollFns = ['listMisInscripciones','getMisInscripciones','listInscripcionesMe'];
    for (const fn of myEnrollFns) {
      if (typeof api[fn] === 'function') return api[fn]();
    }

    // Fallback: todas → filtrar por usuario
    const meId = (this.auth.usuario as any)?._id || (this.auth.usuario as any)?.id || '';
    const getAll: () => Observable<Inscripcion[]> =
      this.api.getInscripciones?.bind(this.api) ??
      this.api.listInscripciones?.bind(this.api) ??
      (() => of<Inscripcion[]>([]));

    return getAll().pipe(
      map((all: Inscripcion[]) => (all || []).filter((i: Inscripcion) => {
        const estId = this.idOf((i as any).estudiante);
        return estId === meId;
      }))
    );
  }

  // ---------- helpers ----------
  private looksLikeCursoArray(arr: any[]): arr is Curso[] {
    return Array.isArray(arr) && (!!arr.length ? ('titulo' in (arr[0] || {})) : true);
  }
  /** ⚠️ Pública para usarla en el template */
  idOf(x: any): string {
    if (!x) return '';
    if (typeof x === 'string') return x;
    return (x._id ?? x.id ?? x.uid ?? x._uid ?? '') as string;
  }
  profName(p: any): string { return typeof p === 'string' ? p : (p?.nombre || ''); }
  trackCurso = (_: number, c: Curso | CursoCard) => (c as any)._id ?? (c as any).titulo;
}