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

import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip'; // ✅ CAMBIO: tooltip

import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { ApiService } from '../../core/api.service';
import { Curso } from '../../data/curso.model';
import { EstadoVistaComponent } from '../../shared/estado-vista.component';
import { mensajeDeError } from '../../core/http-error';

@Component({
  standalone: true,
  selector: 'app-professor-dashboard',
  imports: [
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatProgressBarModule,
    MatTooltipModule,
    EstadoVistaComponent,
  ],
  templateUrl: './professor-dashboard.component.html',
  styleUrls: ['./professor-dashboard.component.scss'],
})
export class ProfessorDashboardComponent implements OnInit {
  // Servicios
  auth = inject(AuthService);
  private api = inject(ApiService);

  // Estado
  loading = false;
  error = '';
  cursos: Curso[] = [];
  inscritosPorCurso = new Map<string, number>();
  totalEstudiantes = 0;

  // CAMBIO: el CTA ahora apunta a la ruta de profesor
  classesLink = '/profesor/clases';

  ngOnInit(): void {
    this.cargar();
  }

  /** Carga cursos del profesor + inscripciones y calcula KPIs */
  cargar(): void {
    this.loading = true;
    this.error = '';

    forkJoin({
      // Sin catchError en los internos: antes un fallo se convertía en `[]` y
      // la pantalla decía "no tienes cursos" cuando en realidad no se habían
      // podido pedir. Ahora el error llega al subscribe y se muestra.
      cursos: this.api.listCursosDeProfesorMe(),
      ins: this.api.listInscripciones(),
    }).subscribe({
      next: ({ cursos, ins }) => {
        this.cursos = cursos || [];

        // Map de cursoId -> conteo de alumnos
        this.inscritosPorCurso.clear();
        this.totalEstudiantes = 0;

        const idsCursos = new Set(this.cursos.map(c => this.idOf(c)));

        for (const i of ins || []) {
          const cursoId = this.idOf(i.curso);
          if (!cursoId || !idsCursos.has(cursoId)) continue;

          const prev = this.inscritosPorCurso.get(cursoId) || 0;
          this.inscritosPorCurso.set(cursoId, prev + 1);
          this.totalEstudiantes++;
        }

        this.loading = false;
      },
      error: err => {
        this.cursos = [];
        this.inscritosPorCurso.clear();
        this.totalEstudiantes = 0;
        this.loading = false;
        this.error = mensajeDeError(err, 'No se pudieron cargar tus clases');
      },
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

  /** Identidad estable para el `track` de @for */
  trackById = (_: number, item: any) => this.idOf(item) || _;
}
