// src/app/features/estudiante/student-courses.component.ts
// ---------------------------------------------------------------------------
// Catálogo de cursos: buscar y matricularse.
//
// La búsqueda la hace el servidor (?buscar=), con 300 ms de espera entre
// pulsaciones. Antes se descargaban 100 cursos y se filtraban aquí: con 101
// cursos, la búsqueda dejaba fuera resultados reales sin decir nada.
// ---------------------------------------------------------------------------

import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-student-courses',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  templateUrl: './student-courses.component.html',
  styleUrls: ['./student-courses.component.scss'],
})
export class StudentCoursesComponent implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  readonly cursos = signal<Curso[]>([]);
  readonly inscripciones = signal<Inscripcion[]>([]);

  readonly cargando = signal(false);
  readonly errorCarga = signal('');

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
          this.cargando.set(true);
          this.errorCarga.set('');
        }),
        switchMap(texto =>
          this.api.listCursos({ buscar: texto }).pipe(
            // Este catchError no se traga el fallo: lo deja en errorCarga, que
            // la plantilla pinta como estado de error. Está aquí dentro para
            // que un error no mate el flujo y deje el buscador muerto.
            catchError(err => {
              this.errorCarga.set(mensajeDeError(err, 'No se pudieron cargar los cursos.'));
              return of<Curso[]>([]);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(cs => {
        this.cursos.set(cs ?? []);
        this.cargando.set(false);
      });

    this.cargarInscripciones();
  }

  /** Reintenta la búsqueda actual sin recargar la página entera. */
  reintentar(): void {
    this.errorCarga.set('');
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
    return this.inscripciones().some(
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
        next: ins => this.inscripciones.set(ins ?? []),
        // Si esto falla, el catálogo se sigue viendo: lo único que se pierde es
        // saber en qué cursos ya estás, y el backend rechaza el duplicado.
        error: () => this.inscripciones.set([]),
      });
  }

  trackCurso = (_: number, c: Curso) => c._id!;
}
