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
// La tabla completa de alumnos vive en la ficha del curso (/cursos/:id), que es
// donde se puede hacer algo con ellos. Pero esta pantalla dejaba el 70 % del
// ancho en blanco enseñando un número, y lo que un profesor viene a ver aquí es
// quién tiene en clase: cada tarjeta lleva ahora los primeros nombres, con el
// resto a un clic. Es información, no aire repartido.
//
// No cuesta ninguna petición más: `GET /api/inscripciones` ya devuelve el
// estudiante POBLADO y esta pantalla ya la pedía — solo contaba lo que le
// llegaba y tiraba los nombres.
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
import { Usuario } from '../../data/usuario.model';
import { Pagina } from '../../data/paginacion';
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
  /** cursoId -> los estudiantes que han llegado, ordenados por nombre. */
  readonly alumnos = signal(new Map<string, Usuario[]>());

  /**
   * Si el listado de matrículas llegó recortado por el tope del backend.
   *
   * El tope es de 100 y es global, no por curso: con más matrículas repartidas
   * entre sus clases, los recuentos de las tarjetas se quedan cortos. Decirlo
   * es lo mismo que hace la ficha con su aviso de truncado; callarlo sería
   * enseñar un número menor que el real sin avisar.
   */
  readonly listaRecortada = signal(false);

  /** Cuántos nombres caben en una tarjeta sin convertirla en una tabla. */
  readonly MAXIMO_EN_TARJETA = 6;

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
      ins: this.api
        .listInscripcionesPaginado()
        .pipe(
          catchError(() => of({ items: [] as Inscripcion[], total: 0 } as Pagina<Inscripcion>))
        ),
    }).subscribe({
      next: ({ cursos, ins }) => {
        this.cursos.set(cursos || []);
        this.repartirPorCurso(ins.items ?? []);
        this.listaRecortada.set((ins.total ?? 0) > (ins.items?.length ?? 0));
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

  /** Los alumnos de un curso que caben en su tarjeta. */
  primeros(c: Curso): Usuario[] {
    return (this.alumnos().get(idDe(c)) ?? []).slice(0, this.MAXIMO_EN_TARJETA);
  }

  /** Cuántos quedan fuera de la tarjeta. Cero si caben todos. */
  restantes(c: Curso): number {
    return Math.max(0, (this.inscritos().get(idDe(c)) ?? 0) - this.MAXIMO_EN_TARJETA);
  }

  /**
   * Una sola gramática para el mismo dato.
   *
   * Antes una tarjeta decía "2 / 20 plazas" y la de al lado "0 estudiantes",
   * según tuvieran cupo o no: la misma métrica con dos formas no se puede
   * comparar de un vistazo, que es justo para lo que sirve una fila de
   * tarjetas. Ahora todas empiezan por el recuento y una barra.
   */
  ocupacion(c: Curso): string {
    const matriculados = this.inscritos().get(idDe(c)) ?? 0;
    return c.cupoMaximo
      ? `${matriculados} / ${c.cupoMaximo} plazas`
      : `${matriculados} / sin límite de plazas`;
  }

  private repartirPorCurso(ins: Inscripcion[]): void {
    const conteo = new Map<string, number>();
    const porCurso = new Map<string, Usuario[]>();

    for (const i of ins) {
      const cursoId = idDe(i?.curso);
      if (!cursoId) continue;
      conteo.set(cursoId, (conteo.get(cursoId) ?? 0) + 1);

      // El estudiante llega poblado; si viniera como id, no hay nombre que
      // pintar y se cuenta pero no se enseña.
      const estudiante = i?.estudiante;
      if (estudiante && typeof estudiante === 'object') {
        porCurso.set(cursoId, [...(porCurso.get(cursoId) ?? []), estudiante]);
      }
    }

    for (const lista of porCurso.values()) {
      lista.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    }

    this.inscritos.set(conteo);
    this.alumnos.set(porCurso);
  }

  trackCurso = (_: number, c: Curso) => idDe(c);
}
