// src/app/features/estudiante/student-courses.component.ts
// ---------------------------------------------------------------------------
// Catálogo de cursos: buscar y matricularse.
//
// La búsqueda la hace el servidor (?buscar=), con 300 ms de espera entre
// pulsaciones. Antes se descargaban 100 cursos y se filtraban aquí: con 101
// cursos, la búsqueda dejaba fuera resultados reales sin decir nada.
// ---------------------------------------------------------------------------

import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // ✅ módulo incluido
import {
  of,
  startWith,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  tap,
} from 'rxjs';

import { ApiService } from '../../core/api.service';
import { mensajeDeError } from '../../core/http-error';
import { Curso } from '../../data/curso.model';
import { Inscripcion } from '../../data/inscripcion.model';

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
        <ng-container *ngIf="cursos as lista">
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
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  cursos: Curso[] = [];
  inscripciones: Inscripcion[] = [];

  cargando = false;
  errorCarga = '';

  q = new FormControl<string>('', { nonNullable: true });

  ngOnInit() {
    this.q.valueChanges
      .pipe(
        // 300 ms: escribir "algoritmos" son once pulsaciones, y sin espera
        // serían once búsquedas.
        debounceTime(300),
        distinctUntilChanged(),
        startWith(this.q.value),
        tap(() => {
          this.cargando = true;
          this.errorCarga = '';
        }),
        switchMap(texto =>
          this.api.listCursos({ buscar: texto }).pipe(
            // Este catchError no se traga el fallo: lo deja en errorCarga, que
            // la plantilla pinta como estado de error. Está aquí dentro para
            // que un error no mate el flujo y deje el buscador muerto.
            catchError(err => {
              this.errorCarga = mensajeDeError(err, 'No se pudieron cargar los cursos.');
              return of<Curso[]>([]);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(cs => {
        this.cursos = cs ?? [];
        this.cargando = false;
      });

    this.cargarInscripciones();
  }

  /** Reintenta la búsqueda actual sin recargar la página entera. */
  reintentar(): void {
    this.errorCarga = '';
    // distinctUntilChanged descartaría el mismo texto, así que se pasa por un
    // valor distinto para forzar el ciclo.
    const texto = this.q.value;
    this.q.setValue(texto === '' ? ' ' : '');
    this.q.setValue(texto);
  }

  profName(p: Curso['profesor']): string {
    return typeof p === 'string' ? '' : (p?.nombre ?? '');
  }

  isEnrolled(cursoId: string): boolean {
    return this.inscripciones.some(
      i => (typeof i.curso === 'string' ? i.curso : i.curso?._id) === cursoId
    );
  }

  matricular(c: Curso) {
    this.api.enrollMe(c._id!).subscribe({
      next: () => {
        this.snack.open('¡Matriculado con éxito!', 'OK', { duration: 2000 });
        this.cargarInscripciones();
      },
      error: err =>
        this.snack.open(mensajeDeError(err, 'No se pudo matricular.'), 'Cerrar', {
          duration: 3000,
        }),
    });
  }

  private cargarInscripciones(): void {
    this.api
      .listInscripcionesMe()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ins => (this.inscripciones = ins ?? []),
        // Si esto falla, el catálogo se sigue viendo: lo único que se pierde es
        // saber en qué cursos ya estás, y el backend rechaza el duplicado.
        error: () => (this.inscripciones = []),
      });
  }

  trackCurso = (_: number, c: Curso) => c._id!;
}
