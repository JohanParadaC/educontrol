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
import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Curso } from '../../data/curso.model';
import { mensajeDeError } from '../../core/http-error';

import { idDe } from '../../data/sesion-local';
import { EstadoVistaComponent } from '../../shared/estado-vista.component';
import { KpiComponent } from '../../shared/kpi.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-student-dashboard',
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    EstadoVistaComponent,
    KpiComponent,
  ],
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.scss'],
})
export class StudentDashboardComponent implements OnInit {
  private api = inject(ApiService);
  public auth = inject(AuthService);
  private snack = inject(MatSnackBar);

  /** Catálogo completo. */
  readonly cursos = signal<Curso[]>([]);
  /** Catálogo menos los ya matriculados. */
  readonly cursosDisponibles = signal<Curso[]>([]);
  /** Los cursos en los que está matriculado. */
  readonly misCursosCards = signal<Curso[]>([]);

  readonly loadingCursos = signal(false);
  readonly loadingIns = signal(false);
  /**
   * Fallo de carga.
   *
   * Existe porque antes NO existía: las dos peticiones llevaban
   * `catchError(() => of([]))` y un servidor caído se pintaba como "aún no
   * estás matriculado en ningún curso". Son cosas distintas y llevan a
   * acciones distintas: una se arregla matriculándose, la otra reintentando.
   */
  readonly error = signal('');
  /** Controla el "Matriculando…" de la tarjeta que se está enviando. */
  readonly matriculandoId = signal<string | null>(null);

  /**
   * El siguiente paso sale de los datos, no de una lista fija de tareas de
   * mentira: un panel que sugiere lo mismo pase lo que pase no sugiere nada.
   */
  readonly siguientePaso = computed(() => {
    const mios = this.misCursosCards().length;
    const libres = this.cursosDisponibles().length;

    if (!mios && libres)
      return `Todavía no te has matriculado en nada. Hay ${libres} cursos esperando.`;
    if (!mios) return 'Todavía no hay cursos publicados en los que matricularte.';
    if (!libres) return `Estás en los ${mios} cursos del catálogo. No queda ninguno por probar.`;
    return `Vas por ${mios} ${mios === 1 ? 'curso' : 'cursos'}. Quedan ${libres} por explorar.`;
  });

  ngOnInit() {
    this.loadData();
  }

  /** ------------------- Carga de datos ------------------- */
  cargar(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loadingCursos.set(true);
    this.loadingIns.set(true);
    this.error.set('');

    forkJoin({
      // Sin catchError: un fallo tiene que llegar al subscribe y verse. La
      // versión anterior lo convertía en lista vacía y la pantalla mentía.
      cursos: this.api.listCursos(),
      inscripciones: this.api.listInscripcionesMe(),
    })
      .pipe(
        finalize(() => {
          this.loadingCursos.set(false);
          this.loadingIns.set(false);
        })
      )
      .subscribe({
        next: ({ cursos, inscripciones }) => {
          this.cursos.set(cursos ?? []);

          // La inscripción trae el curso poblado, así que no hace falta cruzar
          // con el catálogo: se usa el del catálogo solo para tener el mismo
          // objeto (y el mismo `titulo` del mapper) en las dos listas.
          const porId = new Map(this.cursos().map(c => [this.idOf(c), c]));
          const mios = (inscripciones ?? [])
            .map(i => porId.get(idDe(i.curso)))
            .filter((c): c is Curso => !!c);
          this.misCursosCards.set(mios);

          const matriculados = new Set(mios.map(c => this.idOf(c)));
          this.cursosDisponibles.set(this.cursos().filter(c => !matriculados.has(this.idOf(c))));
        },
        error: err => {
          this.cursos.set([]);
          this.misCursosCards.set([]);
          this.cursosDisponibles.set([]);
          this.error.set(mensajeDeError(err, 'No se pudieron cargar tus cursos.'));
        },
      });
  }

  /** Matricular desde el panel y actualizar las dos listas al vuelo */
  matricular(curso: Curso): void {
    const cursoId = this.idOf(curso);
    if (!cursoId) return;

    this.matriculandoId.set(cursoId);
    this.api
      .enrollMe(cursoId)
      .pipe(finalize(() => this.matriculandoId.set(null)))
      .subscribe({
        next: () => {
          this.misCursosCards.update(lista => [curso, ...lista]);
          this.cursosDisponibles.update(lista => lista.filter(c => this.idOf(c) !== cursoId));
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
