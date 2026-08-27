// src/app/features/profesor/professor-classes.component.ts
// -------------------------------------------------------------------
// Los cursos que imparte el profesor.
//
// Este componente tenía 314 líneas defendiéndose de un backend desconocido:
// toleraba cuatro nombres para el campo curso, ocho para el alumno y cuatro
// para los identificadores, y si `/api/inscripciones` venía vacío probaba siete
// endpoints a ciegas. El contrato real está en este mismo repositorio:
//   GET /api/inscripciones -> { ok, inscripciones: [{ estudiante, curso, fecha }] }
// con `estudiante` y `curso` POBLADOS por Mongoose.
//
// La tabla de alumnos que vivía dentro de cada tarjeta se ha ido a la ficha del
// curso (/cursos/:id), que es donde además se puede hacer algo con ellos. Aquí
// queda el recuento, que es lo que se mira desde un listado: de las
// inscripciones solo se usa cuántas hay por curso, así que ningún nombre ni
// correo llega a pintarse en esta pantalla.
// -------------------------------------------------------------------

import { Component, OnInit, inject, ChangeDetectionStrategy, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '../../core/api.service';
import { Curso } from '../../data/curso.model';
import { Inscripcion } from '../../data/inscripcion.model';
import { idDe } from '../../data/sesion-local';
import { EstadoVistaComponent } from '../../shared/estado-vista.component';
import { descargarBlob, nombreDeCabecera } from '../../shared/descargar';
import { mensajeDeError } from '../../core/http-error';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-professor-classes',
  imports: [RouterLink, MatButtonModule, MatIconModule, EstadoVistaComponent],
  templateUrl: './professor-classes.component.html',
  styleUrls: ['./professor-classes.component.scss'],
})
export class ProfessorClassesComponent implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  /** Id del curso que se está exportando, para bloquear solo su botón. */
  readonly exportandoId = signal('');

  readonly loading = signal(false);
  readonly error = signal('');
  readonly cursos = signal<Curso[]>([]);
  /** cursoId -> cuántos matriculados. */
  readonly inscritos = signal(new Map<string, number>());

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      // Los cursos son el dato esencial: si esa llamada falla hay que decirlo,
      // no fingir una lista vacía.
      cursos: this.api.listCursosDeProfesorMe(),
      // Las inscripciones sí toleran fallo: sin ellas se ven los cursos sin el
      // recuento, que es peor que nada pero mejor que una pantalla vacía.
      ins: this.api.listInscripciones().pipe(catchError(() => of<Inscripcion[]>([]))),
    }).subscribe({
      next: ({ cursos, ins }) => {
        this.cursos.set(cursos || []);
        this.inscritos.set(this.contarPorCurso(ins || []));
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.cursos.set([]);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar tus clases'));
      },
    });
  }

  /** Id de un documento que puede venir poblado o como cadena. */
  idOf(x: unknown): string {
    return idDe(x);
  }

  /** El distintivo del estado, o vacío si el curso está abierto. */
  etiquetaEstado(c: Curso): string {
    return c.estado === 'cerrado' ? 'Cerrado' : c.estado === 'archivado' ? 'Archivado' : '';
  }

  /** Sin cupo nunca está lleno. */
  lleno(c: Curso): boolean {
    return !!c.cupoMaximo && (this.inscritos().get(idDe(c)) ?? 0) >= c.cupoMaximo;
  }

  /** Descarga la lista de matriculados de ese curso. */
  exportar(c: Curso): void {
    const id = idDe(c);
    if (this.exportandoId()) return;
    this.exportandoId.set(id);

    this.api.descargarEstudiantesCsv(id).subscribe({
      next: respuesta => {
        this.exportandoId.set('');
        if (!respuesta.body) {
          this.snack.open('El servidor no devolvió el fichero.', 'Cerrar', { duration: 4000 });
          return;
        }
        // El nombre lo decide el servidor: aquí no se inventa.
        descargarBlob(
          respuesta.body,
          nombreDeCabecera(respuesta.headers.get('Content-Disposition'), 'estudiantes.csv')
        );
      },
      error: err => {
        this.exportandoId.set('');
        this.snack.open(mensajeDeError(err, 'No se pudo exportar la lista.'), 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  private contarPorCurso(ins: Inscripcion[]): Map<string, number> {
    const conteo = new Map<string, number>();
    for (const i of ins) {
      const cursoId = idDe(i?.curso);
      if (!cursoId) continue;
      conteo.set(cursoId, (conteo.get(cursoId) ?? 0) + 1);
    }
    return conteo;
  }

  trackCurso = (_: number, c: Curso) => idDe(c);
}
