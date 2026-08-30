// src/app/features/profesor/professor-dashboard.component.ts
// ---------------------------------------------------------------------------
// El panel del profesor, en formato consola.
//
// Antes: un saludo enorme, dos números sueltos en la franja de arriba y dos
// tercios de pantalla en blanco. Ahora una fila de KPI con tarjetas reales y
// una rejilla de 12 columnas: las clases a 8 y las últimas matrículas a 4.
//
// El saludo se fue con la cabecera: el nombre ya está en la barra lateral y en
// el avatar, y ocupaba el sitio de la información.
// ---------------------------------------------------------------------------

import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';

import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { ApiService } from '../../core/api.service';
import { Curso } from '../../data/curso.model';
import { EstadoVistaComponent } from '../../shared/estado-vista.component';
import { KpiComponent } from '../../shared/kpi.component';
import { Inscripcion } from '../../data/inscripcion.model';
import { idDe } from '../../data/sesion-local';
import { mensajeDeError } from '../../core/http-error';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-professor-dashboard',
  imports: [
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    EstadoVistaComponent,
    KpiComponent,
  ],
  templateUrl: './professor-dashboard.component.html',
  styleUrls: ['./professor-dashboard.component.scss'],
})
export class ProfessorDashboardComponent implements OnInit {
  // Servicios
  auth = inject(AuthService);
  private api = inject(ApiService);

  // Estado
  readonly loading = signal(false);
  readonly error = signal('');
  readonly cursos = signal<Curso[]>([]);
  readonly inscritosPorCurso = signal(new Map<string, number>());
  readonly totalEstudiantes = signal(0);

  /** Alumnos matriculados hace menos de siete días, para la variación del KPI. */
  private readonly ultimaSemana = signal(0);

  /** Las cinco matrículas más recientes de sus cursos. */
  readonly recientes = signal<
    Array<{ id: string; nombre: string; iniciales: string; curso: string; cuando: string }>
  >([]);

  /** Media de alumnos por curso, redondeada. Con cero cursos, cero. */
  readonly mediaPorCurso = computed(() => {
    const n = this.cursos().length;
    return n ? Math.round(this.totalEstudiantes() / n) : 0;
  });

  /** Solo se pinta si hay algo que contar: un "+0" no dice nada. */
  readonly variacionSemana = computed(() => {
    const n = this.ultimaSemana();
    return n ? `+${n} esta semana` : '';
  });

  // CAMBIO: el CTA ahora apunta a la ruta de profesor
  classesLink = '/profesor/clases';

  ngOnInit(): void {
    this.cargar();
  }

  /** Carga cursos del profesor + inscripciones y calcula KPIs */
  cargar(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      // Sin catchError en los internos: antes un fallo se convertía en `[]` y
      // la pantalla decía "no tienes cursos" cuando en realidad no se habían
      // podido pedir. Ahora el error llega al subscribe y se muestra.
      cursos: this.api.listCursosDeProfesorMe(),
      ins: this.api.listInscripciones(),
    }).subscribe({
      next: ({ cursos, ins }) => {
        this.cursos.set(cursos || []);

        // Map de cursoId -> conteo de alumnos
        // Se cuenta sobre un Map nuevo y se publica de una vez: mutar el que
        // ya está en la señal no avisaría a nadie de que ha cambiado.
        const conteo = new Map<string, number>();
        let total = 0;

        const idsCursos = new Set(this.cursos().map(c => this.idOf(c)));

        for (const i of ins || []) {
          const cursoId = this.idOf(i.curso);
          if (!cursoId || !idsCursos.has(cursoId)) continue;

          conteo.set(cursoId, (conteo.get(cursoId) || 0) + 1);
          total++;
        }

        this.inscritosPorCurso.set(conteo);
        this.totalEstudiantes.set(total);
        this.ultimaSemana.set(this.contarUltimaSemana(ins || [], idsCursos));
        this.recientes.set(this.ultimasMatriculas(ins || [], idsCursos));
        this.loading.set(false);
      },
      error: err => {
        this.cursos.set([]);
        this.inscritosPorCurso.set(new Map());
        this.totalEstudiantes.set(0);
        this.loading.set(false);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar tus clases'));
      },
    });
  }

  // === Helpers usados en el template ===

  /** Id de un documento que puede venir poblado o como cadena. */
  idOf(x: unknown): string {
    return idDe(x);
  }

  /**
   * Matriculados y plazas, con la misma gramática que el resto del producto.
   *
   * Aquí ponía "N estudiantes" y en "Mis clases", con cupo, "2 / 20 plazas":
   * el mismo dato con dos formas no se compara de un vistazo, y este era el
   * tercer sitio donde se escribía distinto.
   */
  ocupacion(c: Curso): string {
    const matriculados = this.inscritosPorCurso().get(idDe(c)) ?? 0;
    return c.cupoMaximo
      ? `${matriculados} / ${c.cupoMaximo} plazas`
      : `${matriculados} / sin límite de plazas`;
  }

  /**
   * Título del curso.
   *
   * Miraba también `titulo`, y de eso ya se encarga `curso.mapper`: es el
   * único sitio donde `nombre` se traduce, y repetirlo aquí es exactamente el
   * `?? nombre` de nueve sitios que el mapper vino a borrar.
   */
  courseTitle(c: Curso): string {
    return c?.titulo || '';
  }

  /**
   * Descripción del curso.
   *
   * Aceptaba además `descripcionCorta` y `desc`, que no existen en
   * `models/Curso.js` ni en ninguna respuesta: eran ramas muertas escritas por
   * si acaso, y con `any` el compilador no podía decirlo.
   */
  courseDesc(c: Curso): string {
    return c?.descripcion || '';
  }

  /** Cuántas matrículas de sus cursos son de los últimos siete días. */
  private contarUltimaSemana(ins: Inscripcion[], mios: Set<string>): number {
    const hace7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return ins.filter(i => mios.has(idDe(i.curso)) && this.fechaDe(i) >= hace7).length;
  }

  /** Las cinco matrículas más recientes, ya listas para pintar. */
  private ultimasMatriculas(ins: Inscripcion[], mios: Set<string>) {
    return ins
      .filter(i => mios.has(idDe(i.curso)))
      .sort((a, b) => this.fechaDe(b) - this.fechaDe(a))
      .slice(0, 5)
      .map(i => {
        const alumno = typeof i.estudiante === 'string' ? null : i.estudiante;
        const nombre = alumno?.nombre ?? 'Alumno';
        return {
          id: i._id,
          nombre,
          iniciales: this.iniciales(nombre),
          curso: typeof i.curso === 'string' ? '' : (i.curso?.titulo ?? ''),
          cuando: this.hace(this.fechaDe(i)),
        };
      });
  }

  /** `createdAt` es lo bueno; `fecha` se queda por los documentos antiguos. */
  private fechaDe(i: Inscripcion): number {
    const cruda = (i as { createdAt?: string }).createdAt ?? i.fecha;
    const t = cruda ? Date.parse(cruda) : NaN;
    return Number.isNaN(t) ? 0 : t;
  }

  private iniciales(nombre: string): string {
    return (
      nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(p => p[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }

  /** "hoy", "ayer", "hace 4 días"… Sin librería de fechas para tres casos. */
  private hace(t: number): string {
    if (!t) return '';
    const dias = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 30) return `hace ${dias} días`;
    return new Date(t).toLocaleDateString('es');
  }

  /** Identidad estable para el `track` de @for */
  trackById = (_: number, item: unknown) => this.idOf(item) || _;
}
