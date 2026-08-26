// src/app/features/estudiante/student-my-courses.component.ts
// ---------------------------------------------------------------------------
// Las matrículas del estudiante, con la opción de darse de baja.
//
// Esta pantalla estaba enrutada pero no enlazada desde ningún sitio, y sus tres
// acciones estaban rotas: `desmatricular()` llamaba a un método que no existía
// y avisaba de que "tu API no expone endpoint para cancelar matrícula",
// `irAlCurso()` abría un aviso de "próximamente" y se pintaba un `progreso`
// que el backend no tiene.
//
// Ahora la baja es real (DELETE /api/inscripciones/:id), el campo inventado ha
// desaparecido y el enlace está en el navbar. "Ir al curso" se ha quitado
// hasta que exista la ficha de curso: un botón cuyo único efecto es decir que
// no hace nada es peor que no tener botón.
// ---------------------------------------------------------------------------
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { mensajeDeError } from '../../core/http-error';
import { Curso } from '../../data/curso.model';
import { Inscripcion } from '../../data/inscripcion.model';
import { EstadoVistaComponent } from '../../shared/estado-vista.component';

@Component({
  standalone: true,
  selector: 'app-student-my-courses',
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    EstadoVistaComponent,
  ],
  template: `
    <h2 class="titulo">Mis cursos</h2>

    <app-estado-vista
      *ngIf="cargando || error || !inscripciones.length"
      [cargando]="cargando"
      [error]="error"
      mensajeVacio="Aún no tienes cursos."
      iconoVacio="school"
      (reintentar)="cargar()"
    >
    </app-estado-vista>

    <div class="grid gap-3" *ngIf="!cargando && !error && inscripciones.length">
      <mat-card class="course" *ngFor="let i of inscripciones; trackBy: trackIns">
        <div class="head">
          <div>
            <h3>{{ tituloDe(i.curso) }}</h3>
            <div class="muted">{{ profesorDe(i.curso) || '—' }}</div>
          </div>
          <button
            mat-stroked-button
            color="warn"
            [disabled]="cancelandoId === i._id"
            (click)="desmatricular(i)"
          >
            <mat-icon>cancel</mat-icon>
            {{ cancelandoId === i._id ? 'Cancelando…' : 'Cancelar matrícula' }}
          </button>
        </div>
      </mat-card>
    </div>

    <p class="pie" *ngIf="!cargando && !error">
      <a routerLink="/cursos">Explorar el catálogo</a>
    </p>
  `,
  styles: [
    `
      .titulo {
        font: var(--mat-sys-headline-small);
        margin: 0 0 16px;
      }
      .grid {
        display: grid;
      }
      .gap-3 {
        gap: 12px;
      }
      .course {
        padding: 12px;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .head h3 {
        margin: 0;
      }
      .muted {
        opacity: 0.7;
      }
      .pie {
        margin-top: 16px;
      }
      @media (max-width: 700px) {
        .head {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class StudentMyCoursesComponent implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  inscripciones: Inscripcion[] = [];
  cargando = false;
  error = '';
  cancelandoId: string | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.api.listInscripcionesMe().subscribe({
      next: ins => {
        this.inscripciones = ins ?? [];
        this.cargando = false;
      },
      error: err => {
        // Un fallo de carga no es "no tienes cursos": llevan a acciones distintas.
        this.error = mensajeDeError(err, 'No se pudieron cargar tus cursos.');
        this.cargando = false;
      },
    });
  }

  desmatricular(i: Inscripcion): void {
    this.cancelandoId = i._id;
    this.api.deleteInscripcion(i._id).subscribe({
      next: () => {
        this.cancelandoId = null;
        this.inscripciones = this.inscripciones.filter(x => x._id !== i._id);
        this.snack.open('Matrícula cancelada', 'OK', { duration: 2000 });
      },
      error: err => {
        this.cancelandoId = null;
        this.snack.open(mensajeDeError(err, 'No se pudo cancelar la matrícula.'), 'Cerrar', {
          duration: 3000,
        });
      },
    });
  }

  tituloDe(c: string | Curso): string {
    return typeof c === 'string' ? c : (c?.titulo ?? '—');
  }

  profesorDe(c: string | Curso): string {
    if (typeof c === 'string') return '';
    return typeof c.profesor === 'string' ? '' : (c.profesor?.nombre ?? '');
  }

  trackIns = (_: number, i: Inscripcion) => i._id;
}
