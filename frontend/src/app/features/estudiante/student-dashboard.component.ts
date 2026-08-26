// src/app/features/estudiante/student-dashboard.component.ts
// ---------------------------------------------------------------------------
// Panel del estudiante: sus cursos y los que puede matricular.
//
// Este componente se defendía de una API imaginaria: probaba cinco nombres
// para "mis cursos", tres para "mis inscripciones" y dos para el catálogo,
// y si ninguno existía se descargaba todo y filtraba a mano. Ninguno de esos
// métodos existe en ApiService, que está en este mismo repositorio y se puede
// leer. Ahora llama a los reales.
// ---------------------------------------------------------------------------
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { of, forkJoin } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Curso } from '../../data/curso.model';
import { mensajeDeError } from '../../core/http-error';

import { Inscripcion } from '../../data/inscripcion.model';
import { idDe } from '../../data/sesion-local';

@Component({
  standalone: true,
  selector: 'app-student-dashboard',
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatDividerModule,
    MatSnackBarModule,
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
              <mat-card
                class="course"
                *ngFor="let c of cursosDisponibles | slice: 0 : 6; trackBy: trackCurso"
              >
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
                    [disabled]="matriculandoId === idOf(c)"
                  >
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
  styles: [
    `
      .wrap {
        display: grid;
        gap: 16px;
        padding: 0 4px;
      }
      .brand .brand-wrap {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .brand h1 {
        margin: 0;
      }
      .actions a {
        margin-left: 8px;
      }
      .card-title {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 8px;
      }
      .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }
      .course {
        min-height: 140px;
      }
      .desc {
        margin: 0.25rem 0 0.5rem;
        opacity: 0.9;
      }
      .progress {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .progress mat-progress-bar {
        flex: 1;
      }
      .empty {
        opacity: 0.7;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      @media (max-width: 900px) {
        .actions {
          display: none;
        }
      }
    `,
  ],
})
export class StudentDashboardComponent implements OnInit {
  private api = inject(ApiService);
  public auth = inject(AuthService);
  private snack = inject(MatSnackBar);

  cursos: Curso[] = []; // Catálogo completo
  cursosDisponibles: Curso[] = []; // Catálogo menos los ya matriculados
  misCursosCards: Curso[] = []; // Los cursos en los que está matriculado

  loadingCursos = false;
  loadingIns = false;
  matriculandoId: string | null = null; // Controla el "Matriculando…"

  ngOnInit() {
    this.loadData();
  }

  /** ------------------- Carga de datos ------------------- */
  private loadData(): void {
    this.loadingCursos = true;
    this.loadingIns = true;

    forkJoin({
      cursos: this.api.listCursos().pipe(catchError(() => of<Curso[]>([]))),
      inscripciones: this.api.listInscripcionesMe().pipe(catchError(() => of<Inscripcion[]>([]))),
    })
      .pipe(
        finalize(() => {
          this.loadingCursos = false;
          this.loadingIns = false;
        })
      )
      .subscribe(({ cursos, inscripciones }) => {
        this.cursos = cursos ?? [];

        // La inscripción trae el curso poblado, así que no hace falta cruzar
        // con el catálogo: se usa el del catálogo solo para tener el mismo
        // objeto (y el mismo `titulo` del mapper) en las dos listas.
        const porId = new Map(this.cursos.map(c => [this.idOf(c), c]));
        this.misCursosCards = (inscripciones ?? [])
          .map(i => porId.get(idDe(i.curso)))
          .filter((c): c is Curso => !!c);

        const matriculados = new Set(this.misCursosCards.map(c => this.idOf(c)));
        this.cursosDisponibles = this.cursos.filter(c => !matriculados.has(this.idOf(c)));
      });
  }

  /** Matricular desde el panel y actualizar las dos listas al vuelo */
  matricular(curso: Curso): void {
    const cursoId = this.idOf(curso);
    if (!cursoId) return;

    this.matriculandoId = cursoId;
    this.api
      .enrollMe(cursoId)
      .pipe(finalize(() => (this.matriculandoId = null)))
      .subscribe({
        next: () => {
          this.misCursosCards = [curso, ...this.misCursosCards];
          this.cursosDisponibles = this.cursosDisponibles.filter(c => this.idOf(c) !== cursoId);
          this.snack.open('¡Matriculado con éxito!', 'OK', { duration: 2500 });
        },
        error: err =>
          this.snack.open(mensajeDeError(err, 'No se pudo matricular.'), 'Cerrar', {
            duration: 3500,
          }),
      });
  }

  // ---------- helpers ----------
  /** Pública para usarla en la plantilla. */
  idOf(x: Curso | string | null | undefined): string {
    return idDe(x);
  }

  profName(p: Curso['profesor']): string {
    return typeof p === 'string' ? p : (p?.nombre ?? '');
  }

  trackCurso = (_: number, c: Curso) => this.idOf(c) || c.titulo;
}
