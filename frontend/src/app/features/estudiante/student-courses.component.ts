// src/app/student/student-courses.component.ts
// Catálogo de cursos (búsqueda + auto-matrícula con ApiService.enrollMe).

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // ✅ módulo incluido
import { BehaviorSubject, of, combineLatest, startWith, map, switchMap, Observable } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { mensajeDeError } from '../../core/http-error';
import { Curso } from '../../data/curso.model';

type Inscripcion = { _id: string; curso: string | Curso; estudiante?: any; cursoId?: string };

@Component({
  standalone: true,
  selector: 'app-student-courses',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule, // ✅
  ],
  template: `
    <div class="grid gap-3">
      <div class="toolbar">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Buscar curso</mat-label>
          <input matInput [formControl]="q" placeholder="Título, profesor, descripción…" />
        </mat-form-field>
      </div>

      <!-- 1) Cargando: esqueletos, para que el salto de vacío a lleno no dé tirón -->
      <div *ngIf="cargando" class="grid cards" aria-busy="true" aria-label="Cargando cursos">
        <mat-card class="course esqueleto" *ngFor="let _ of [1, 2, 3]">
          <div class="linea titulo"></div>
          <div class="linea corta"></div>
          <div class="linea"></div>
        </mat-card>
      </div>

      <!-- 2) Error de carga: distinto de "no hay cursos", y con salida -->
      <div *ngIf="!cargando && errorCarga" class="estado error" role="alert">
        <mat-icon>error_outline</mat-icon>
        <p>{{ errorCarga }}</p>
        <button mat-stroked-button (click)="reintentar()">Reintentar</button>
      </div>

      <ng-container *ngIf="!cargando && !errorCarga">
        <ng-container *ngIf="filtered | async as lista">
          <div class="grid cards">
            <mat-card *ngFor="let c of lista; trackBy: trackCurso" class="course">
              <h3>{{ c.titulo }}</h3>
              <div class="muted">{{ profName(c.profesor) || '—' }}</div>
              <p class="desc">{{ c.descripcion }}</p>

              <div class="actions">
                <button
                  mat-stroked-button
                  color="primary"
                  [disabled]="isEnrolled(c._id!)"
                  (click)="matricular(c)"
                >
                  <mat-icon>how_to_reg</mat-icon>
                  {{ isEnrolled(c._id!) ? 'Ya inscrito' : 'Matricular' }}
                </button>
              </div>
            </mat-card>
          </div>

          <!-- 3) Vacío: y distinguimos "no hay nada" de "tu búsqueda no encuentra" -->
          <div *ngIf="lista.length === 0" class="estado">
            <mat-icon>search_off</mat-icon>
            <p *ngIf="q.value">No hay cursos que coincidan con «{{ q.value }}».</p>
            <p *ngIf="!q.value">Todavía no hay cursos publicados.</p>
            <button mat-stroked-button *ngIf="q.value" (click)="q.setValue('')">
              Quitar el filtro
            </button>
          </div>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [
    `
      .grid {
        display: grid;
      }
      .gap-3 {
        gap: 12px;
      }
      .toolbar {
        max-width: 560px;
      }
      .cards {
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
      }
      .course h3 {
        margin-bottom: 4px;
      }
      .muted {
        opacity: 0.7;
      }
      .desc {
        opacity: 0.85;
      }
      .actions {
        margin-top: 8px;
      }
      .actions button {
        min-height: 48px;
      }

      /* Estado vacío / error: centrado y con una acción, no un texto suelto */
      .estado {
        display: grid;
        justify-items: center;
        gap: 8px;
        padding: 48px 16px;
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
      }
      .estado mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        opacity: 0.6;
      }
      .estado p {
        margin: 0;
      }
      .estado.error {
        color: var(--mat-sys-on-error-container);
      }

      /* Esqueletos de carga: ocupan el sitio de las tarjetas reales para que al
       llegar los datos la página no pegue un salto. */
      .esqueleto .linea {
        height: 12px;
        border-radius: 6px;
        margin: 10px 0;
        background: color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent);
        animation: latido 1.4s ease-in-out infinite;
      }
      .esqueleto .titulo {
        height: 20px;
        width: 70%;
      }
      .esqueleto .corta {
        width: 40%;
      }
      @keyframes latido {
        0%,
        100% {
          opacity: 0.45;
        }
        50% {
          opacity: 0.9;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .esqueleto .linea {
          animation: none;
        }
      }

      @media (max-width: 1100px) {
        .cards {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 700px) {
        .cards {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class StudentCoursesComponent implements OnInit {
  private api = inject(ApiService) as any;
  private snack = inject(MatSnackBar);

  private cursos$ = new BehaviorSubject<Curso[]>([]);
  cursos: Curso[] = [];
  inscripciones: Inscripcion[] = [];

  cargando = false;
  errorCarga = '';

  q = new FormControl<string>('', { nonNullable: true });

  filtered = combineLatest([this.q.valueChanges.pipe(startWith('')), this.cursos$]).pipe(
    map(([q, cursos]) => this.filterCourses(cursos, q))
  );

  ngOnInit() {
    // Catálogo
    this.cargando = true;
    (this.api.listCursos?.() ?? this.api.getCursos?.() ?? of<Curso[]>([])).subscribe({
      next: (cs: Curso[]) => {
        this.cursos = cs || [];
        this.cursos$.next(this.cursos);
        this.cargando = false;
      },
      error: (err: unknown) => {
        // Un fallo al cargar no puede parecerse a "no hay cursos": son cosas
        // distintas y el usuario necesita saber cuál le ha tocado.
        this.errorCarga = mensajeDeError(err, 'No se pudieron cargar los cursos.');
        this.cargando = false;
      },
    });

    // Mis inscripciones
    this.getMyEnrollments().subscribe((ins: Inscripcion[]) => {
      this.inscripciones = ins || [];
    });
  }

  /** Reintenta la carga sin obligar a recargar la página entera. */
  reintentar(): void {
    this.errorCarga = '';
    this.ngOnInit();
  }

  profName(p: any): string {
    return typeof p === 'string' ? '' : p?.nombre || '';
  }

  filterCourses(cursos: Curso[], q: string): Curso[] {
    const s = (q || '').trim().toLowerCase();
    if (!s) return cursos;
    return cursos.filter(
      c =>
        c.titulo?.toLowerCase().includes(s) ||
        c.descripcion?.toLowerCase().includes(s) ||
        this.profName(c.profesor).toLowerCase().includes(s)
    );
  }

  isEnrolled(cursoId: string): boolean {
    return this.inscripciones.some(
      i => (typeof i.curso === 'string' ? i.curso : i.curso?._id) === cursoId
    );
  }

  // ✅ Usa enrollMe; sin snackbar viejo
  matricular(c: Curso) {
    const id = c._id!;
    (this.api.enrollMe?.(id) as Observable<any>).subscribe({
      next: () => {
        this.snack.open('¡Matriculado con éxito!', 'OK', { duration: 2000 });
        // refrescar inscripciones locales
        this.getMyEnrollments().subscribe((ins: Inscripcion[]) => (this.inscripciones = ins || []));
      },
      error: (e: any) =>
        this.snack.open(e?.error?.msg || 'No se pudo matricular', 'Cerrar', { duration: 3000 }),
    });
  }

  // ✅ Tipado explícito
  private getMyEnrollments(): Observable<Inscripcion[]> {
    const api: any = this.api;
    if (api.listMisInscripciones) return api.listMisInscripciones();
    if (api.listInscripcionesMe) return api.listInscripcionesMe();
    if (api.listInscripciones && api.me) {
      return api.me().pipe(
        switchMap((me: any) =>
          api.listInscripciones().pipe(
            map((all: Inscripcion[]) =>
              (all || []).filter(i => {
                const estId = (i as any).estudiante?._id || (i as any).estudiante || '';
                return String(estId) === String(me?._id || me?.id || '');
              })
            )
          )
        )
      );
    }
    return of<Inscripcion[]>([]);
  }

  trackCurso = (_: number, c: Curso) => c._id!;
}
