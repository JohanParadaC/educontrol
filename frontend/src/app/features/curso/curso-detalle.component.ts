// src/app/features/curso/curso-detalle.component.ts
// ---------------------------------------------------------------------------
// La ficha de un curso: /cursos/:id
//
// Era el agujero más visible del producto. Había cuatro sitios que prometían
// llevar "al curso" y ninguno llegaba: el del profesor abría el listado de
// clases, el del estudiante el catálogo, y "Mis cursos" enseñaba un aviso que
// decía "próximamente". Un enlace que no lleva a donde dice es peor que no
// tener enlace.
//
// La pantalla la ven los tres roles y enseña cosas distintas a cada uno, pero
// quién puede ver la lista de matriculados NO lo decide este componente: lo
// decide el servidor mandando o no mandando `estudiantes`. Aquí solo se pinta
// lo que ha llegado.
// ---------------------------------------------------------------------------
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { of, forkJoin } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { mensajeDeError } from '../../core/http-error';
import { rutaInicioPara } from '../../core/rutas';
import { CursoEditable, CursoDetalle, EstadoCurso } from '../../data/curso.model';
import { Inscripcion } from '../../data/inscripcion.model';
import { Usuario } from '../../data/usuario.model';
import { idDe } from '../../data/sesion-local';
import { EstadoVistaComponent } from '../../shared/estado-vista.component';
import { descargarBlob, nombreDeCabecera } from '../../shared/descargar';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { CourseCreateDialogComponent } from '../admin/course-create-dialog.component';
import {
  EnrollStudentDialogComponent,
  MatriculaPedida,
} from '../admin/enroll-student-dialog.component';

/** Una miga de pan. La última no lleva enlace: es donde estás. */
interface Miga {
  texto: string;
  ruta?: string;
}

/** Iniciales de un nombre, dos como mucho. */
function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-curso-detalle',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatTableModule, EstadoVistaComponent],
  templateUrl: './curso-detalle.component.html',
  styleUrls: ['./curso-detalle.component.scss'],
})
export class CursoDetalleComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  readonly id = signal('');
  readonly detalle = signal<CursoDetalle | null>(null);
  /** La matrícula del propio estudiante, si la tiene. Da el id para la baja. */
  readonly miInscripcion = signal<Inscripcion | null>(null);

  readonly cargando = signal(false);
  readonly error = signal('');
  /** 404 y 400 (id mal formado) son lo mismo para quien mira: no existe. */
  readonly noExiste = signal(false);
  /** Bloquea el doble envío de la acción principal. */
  readonly ocupado = signal(false);

  readonly rol = this.auth.rol;
  readonly esEstudiante = computed(() => this.rol() === 'estudiante');
  readonly esAdmin = computed(() => this.rol() === 'admin');

  readonly esProfesorPropietario = computed(() => {
    const usuario = this.auth.usuario();
    if (usuario?.rol !== 'profesor') return false;
    return idDe(this.detalle()?.curso?.profesor) === idDe(usuario);
  });

  readonly puedeGestionar = computed(() => this.esAdmin() || this.esProfesorPropietario());

  /**
   * Si se enseña la lista de matriculados.
   *
   * Sale de que el servidor la haya mandado, no de lo que este componente crea
   * del rol: la autorización es suya y aquí se obedece. Por eso el modelo
   * distingue `undefined` de `[]`.
   */
  readonly puedeVerEstudiantes = computed(() => this.detalle()?.estudiantes !== undefined);
  readonly estudiantes = computed<Usuario[]>(() => this.detalle()?.estudiantes ?? []);
  readonly columnas = ['nombre', 'correo'];

  /**
   * El servidor recorta la lista en 100. Cuando lo hace, hay que decirlo.
   *
   * Enseñar 100 de 340 sin avisar es la misma clase de mentira que pintar un
   * error como una lista vacía. El aviso lleva al CSV, que sí los trae todos.
   */
  readonly listaTruncada = computed(() => !!this.detalle()?.estudiantesTruncados);
  readonly avisoTruncado = computed(() =>
    this.listaTruncada()
      ? `Mostrando los primeros ${this.estudiantes().length} de ${this.matriculados()}.`
      : ''
  );

  readonly matriculado = computed(() => !!this.miInscripcion());

  readonly cupoMaximo = computed(() => this.detalle()?.curso?.cupoMaximo ?? 0);
  readonly estado = computed<EstadoCurso>(() => this.detalle()?.curso?.estado ?? 'abierto');
  readonly lleno = computed(() => !!this.cupoMaximo() && this.matriculados() >= this.cupoMaximo());

  /**
   * Por qué no se puede uno matricular, o cadena vacía si sí se puede.
   *
   * Es un texto y no un booleano porque se pinta: un botón apagado sin motivo
   * al lado deja al usuario probando a pulsarlo. El servidor comprueba lo
   * mismo y devuelve 409; esto solo evita el viaje.
   */
  readonly motivoBloqueo = computed(() => {
    if (this.estado() === 'archivado') return 'Este curso está archivado y no admite matrículas.';
    if (this.estado() === 'cerrado') return 'Este curso está cerrado a nuevas matrículas.';
    if (this.lleno()) return 'No quedan plazas libres.';
    return '';
  });

  /** La etiqueta del estado, para el distintivo de la cabecera. */
  readonly etiquetaEstado = computed(() =>
    this.estado() === 'cerrado' ? 'Cerrado' : this.estado() === 'archivado' ? 'Archivado' : ''
  );

  /** Descarga en curso: bloquea el botón y cambia su texto. */
  readonly exportando = signal(false);

  readonly titulo = computed(() => this.detalle()?.curso?.titulo ?? '');
  readonly descripcion = computed(() => this.detalle()?.curso?.descripcion ?? '');
  readonly matriculados = computed(() => this.detalle()?.matriculados ?? 0);

  readonly profesor = computed<Usuario | null>(() => {
    const p = this.detalle()?.curso?.profesor;
    return p && typeof p === 'object' ? (p as Usuario) : null;
  });

  /** Iniciales para el avatar del profesor. */
  readonly inicialesProfesor = computed(() => iniciales(this.profesor()?.nombre ?? ''));

  /** Sigla del curso, para la placa teñida de la cabecera. */
  readonly inicialesCurso = computed(() => iniciales(this.titulo()));

  /**
   * El tono del curso, de 0 a 359.
   *
   * SOLO el tono: la saturación y la luminosidad salen de los tokens
   * `--curso-*` de styles.scss, que son las que cambian entre claro y oscuro.
   * Un color entero calculado aquí no sabría en qué tema se va a pintar.
   */
  readonly tono = computed(() => {
    const semilla = idDe(this.detalle()?.curso) || this.titulo();
    let acumulado = 0;
    for (let i = 0; i < semilla.length; i++) {
      acumulado = (acumulado * 31 + semilla.charCodeAt(i)) % 360;
    }
    return acumulado;
  });

  /** De dónde se viene depende del rol, así que la miga del medio también. */
  readonly migas = computed<Miga[]>(() => {
    const seccion =
      this.rol() === 'admin'
        ? { texto: 'Administración', ruta: '/admin' }
        : this.rol() === 'profesor'
          ? { texto: 'Mis clases', ruta: '/profesor/clases' }
          : { texto: 'Catálogo', ruta: '/cursos' };

    return [
      { texto: 'Inicio', ruta: rutaInicioPara(this.rol()) },
      seccion,
      { texto: this.titulo() || 'Curso' },
    ];
  });

  constructor() {
    // La carga cuelga del parámetro y no de ngOnInit: el router reutiliza el
    // componente al ir de un curso a otro, y con ngOnInit /cursos/A → /cursos/B
    // se quedaba enseñando A.
    this.ruta.paramMap
      .pipe(
        map(p => p.get('id') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe(id => {
        this.id.set(id);
        this.cargar();
      });
  }

  cargar(): void {
    const id = this.id();
    if (!id) return;

    this.cargando.set(true);
    this.error.set('');
    this.noExiste.set(false);

    // La matrícula propia solo la necesita el estudiante: es la que decide
    // entre "Matricularme" y "Cancelar matrícula". Al profesor y al admin no se
    // les pide, porque la ficha ya les trae la lista completa.
    forkJoin({
      detalle: this.api.getCursoDetalle(id),
      mias: this.esEstudiante() ? this.api.listInscripcionesPorCurso(id) : of<Inscripcion[]>([]),
    }).subscribe({
      next: ({ detalle, mias }) => {
        this.detalle.set(detalle);
        this.miInscripcion.set(mias[0] ?? null);
        this.cargando.set(false);
      },
      error: err => {
        this.cargando.set(false);
        this.detalle.set(null);
        // 400 es el id mal formado que rechaza el validador de la ruta. Para
        // quien mira significa lo mismo que un 404: ese curso no está.
        if (err?.status === 404 || err?.status === 400) {
          this.noExiste.set(true);
          return;
        }
        this.error.set(mensajeDeError(err, 'No se pudo cargar el curso.'));
      },
    });
  }

  /** La sección de la que se viene: la miga del medio, no la de inicio. */
  readonly seccion = computed(() => this.migas()[1]);

  /** Vuelve al listado del que se venía, que depende del rol. */
  volverAlListado(): void {
    const destino = this.seccion()?.ruta;
    if (destino) this.router.navigateByUrl(destino);
  }

  // ================== ESTUDIANTE ==================

  matricularme(): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);

    this.api.enrollMe(this.id()).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.snack.open('Te has matriculado', 'OK', { duration: 2000 });
        // Se recarga en vez de tocar los contadores a mano: el número de
        // matriculados es del servidor y aquí no se adivina.
        this.cargar();
      },
      error: err => this.falla(err, 'No se pudo completar la matrícula.'),
    });
  }

  cancelarMatricula(): void {
    const inscripcion = this.miInscripcion();
    if (!inscripcion || this.ocupado()) return;

    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: '¿Cancelar la matrícula?',
          message: `Dejarás de estar matriculado en «${this.titulo()}». Puedes volver a matricularte después.`,
          confirmText: 'Cancelar matrícula',
          cancelText: 'Seguir matriculado',
        },
      })
      .afterClosed()
      .subscribe(confirmado => {
        if (!confirmado) return;
        this.ocupado.set(true);
        this.api.deleteInscripcion(inscripcion._id).subscribe({
          next: () => {
            this.ocupado.set(false);
            this.snack.open('Matrícula cancelada', 'OK', { duration: 2000 });
            this.cargar();
          },
          error: err => this.falla(err, 'No se pudo cancelar la matrícula.'),
        });
      });
  }

  // ================== PROFESOR Y ADMIN ==================

  /**
   * Matricular a otra persona.
   *
   * El administrador elige de la lista de estudiantes; el profesor escribe un
   * correo. No es un capricho de interfaz: `GET /api/usuarios` es solo de
   * administrador, y abrirlo a los profesores para llenar un desplegable sería
   * repartir el nombre y el correo de todos los estudiantes del centro.
   */
  matricularEstudiante(): void {
    const conLista = this.esAdmin()
      ? this.api.listUsuariosPorRol('estudiante')
      : of<Usuario[] | undefined>(undefined);

    conLista.subscribe({
      next: lista => this.abrirMatricular(lista),
      error: err => this.falla(err, 'No se pudo cargar la lista de estudiantes.'),
    });
  }

  private abrirMatricular(estudiantes?: Usuario[]): void {
    this.dialog
      .open(EnrollStudentDialogComponent, {
        width: '460px',
        data: {
          cursoTitulo: this.titulo(),
          estudiantes: estudiantes?.map(e => ({
            _id: idDe(e),
            nombre: e.nombre,
            correo: e.correo,
          })),
        },
      })
      .afterClosed()
      .subscribe((pedida?: MatriculaPedida) => {
        if (!pedida) return;

        const peticion = pedida.estudianteId
          ? this.api.createInscripcion({ curso: this.id(), estudiante: pedida.estudianteId })
          : this.api.matricularPorCorreo(this.id(), pedida.correo ?? '');

        this.ocupado.set(true);
        peticion.subscribe({
          next: () => {
            this.ocupado.set(false);
            this.snack.open('Estudiante matriculado', 'OK', { duration: 2000 });
            this.cargar();
          },
          error: err => this.falla(err, 'No se pudo matricular.'),
        });
      });
  }

  /**
   * Editar el curso, con el mismo diálogo del panel de administración.
   *
   * El selector de profesor solo lo ve el administrador (`soyAdmin`): un
   * profesor puede corregir el título o la descripción de su curso, pero
   * reasignárselo a otro es una decisión de administración, y el backend
   * tampoco se lo dejaría.
   */
  editar(): void {
    const conProfesores = this.esAdmin()
      ? this.api.listUsuariosPorRol('profesor')
      : of<Usuario[]>([]);

    conProfesores.subscribe({
      next: profesores => this.abrirEdicion(profesores),
      error: err => this.falla(err, 'No se pudo cargar la lista de profesores.'),
    });
  }

  private abrirEdicion(profesores: Usuario[]): void {
    this.dialog
      .open(CourseCreateDialogComponent, {
        width: '520px',
        data: {
          soyAdmin: this.esAdmin(),
          profesores: profesores.map(p => ({
            _id: idDe(p),
            nombre: p.nombre,
            correo: p.correo,
          })),
          initial: {
            titulo: this.titulo(),
            descripcion: this.descripcion(),
            profesorId: idDe(this.detalle()?.curso?.profesor),
            cupoMaximo: this.cupoMaximo() || null,
            estado: this.estado(),
          },
        },
      })
      .afterClosed()
      .subscribe(
        (datos?: {
          titulo: string;
          descripcion: string;
          profesor?: string | null;
          cupoMaximo: number | null;
          estado: EstadoCurso;
        }) => {
          if (!datos) return;

          // `cupoMaximo: null` viaja tal cual: es como se quita el límite.
          const cambios: CursoEditable = {
            titulo: datos.titulo,
            descripcion: datos.descripcion,
            cupoMaximo: datos.cupoMaximo,
            estado: datos.estado,
          };
          // El profesor solo viaja si lo ha decidido un administrador. El
          // diálogo devuelve `null` cuando no enseña el selector, y mandar eso
          // sería pedirle al backend que borre el profesor del curso.
          if (this.esAdmin() && datos.profesor) cambios.profesor = datos.profesor;

          this.ocupado.set(true);
          this.api.updateCurso(this.id(), cambios).subscribe({
            next: () => {
              this.ocupado.set(false);
              this.snack.open('Curso actualizado', 'OK', { duration: 2000 });
              this.cargar();
            },
            error: err => this.falla(err, 'No se pudo actualizar el curso.'),
          });
        }
      );
  }

  /**
   * Descarga la lista de matriculados en CSV.
   *
   * El nombre del fichero lo pone el servidor en `Content-Disposition`: quien
   * sabe cómo se llama el curso es quien lo tiene, y aquí solo se lee.
   */
  exportar(): void {
    if (this.exportando()) return;
    this.exportando.set(true);

    this.api.descargarEstudiantesCsv(this.id()).subscribe({
      next: respuesta => {
        this.exportando.set(false);
        const cuerpo = respuesta.body;
        if (!cuerpo) {
          this.snack.open('El servidor no devolvió el fichero.', 'Cerrar', { duration: 4000 });
          return;
        }
        const nombre = nombreDeCabecera(
          respuesta.headers.get('Content-Disposition'),
          'estudiantes.csv'
        );
        descargarBlob(cuerpo, nombre);
      },
      error: err => {
        this.exportando.set(false);
        this.falla(err, 'No se pudo exportar la lista.');
      },
    });
  }

  /** Un solo sitio para soltar el bloqueo y decir qué ha pasado. */
  private falla(err: unknown, porDefecto: string): void {
    this.ocupado.set(false);
    this.snack.open(mensajeDeError(err, porDefecto), 'Cerrar', { duration: 4000 });
  }
}
