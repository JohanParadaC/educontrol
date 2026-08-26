// src/app/admin/admin-dashboard.component.ts
import { Component, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';

import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip'; // ✅ NUEVO: tooltips para íconos
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { EstadoVistaComponent } from '../../shared/estado-vista.component';
import { mensajeDeError } from '../../core/http-error';

import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';

import { ApiService } from '../../core/api.service';
import { Usuario } from '../../data/usuario.model';
import { Curso } from '../../data/curso.model';
import { idDe } from '../../data/sesion-local';
import { CourseCreateDialogComponent } from './course-create-dialog.component';
import { EnrollStudentDialogComponent } from './enroll-student-dialog.component';

// diálogo de confirmación propio (standalone)
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

type Rol = 'estudiante' | 'profesor';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatCheckboxModule,
    MatPaginatorModule,
    EstadoVistaComponent,
  ],
})
export class AdminDashboardComponent implements OnInit {
  readonly usuarios = signal<Usuario[]>([]);
  readonly profesores = signal<Usuario[]>([]);
  readonly estudiantes = signal<Usuario[]>([]);
  readonly cursos = signal<Curso[]>([]);

  // Opciones planas para selects (ID ya normalizado a string)
  readonly profesoresOpt = signal<Array<{ _id: string; nombre: string; correo: string }>>([]);
  readonly estudiantesOpt = signal<Array<{ _id: string; nombre: string; correo: string }>>([]);

  // Controles rápidos para "Asignar profesor"
  cursoCtrl = new FormControl<string | null>(null);
  profeCtrl = new FormControl<string | null>(null);

  readonly isAssigning = signal(false);

  // Cambios de rol en lote
  readonly pendingRoles = signal<Record<string, Rol>>({});
  readonly savingBulk = signal(false);

  /** Ids de los usuarios marcados con la casilla. */
  readonly seleccionados = signal(new Set<string>());

  // Sin columna de ID: en usuarios salía vacía (el backend serializa `id`, no
  // `_id`) y en cursos mostraba el ObjectId crudo, que no le sirve a nadie y en
  // móvil se comía un cuarto del ancho.
  // Tampoco columna 'rol': el select de "Nuevo rol" ya muestra el rol actual.
  displayedUserCols = ['seleccion', 'nombre', 'correo', 'acciones'];
  displayedCourseCols = ['titulo', 'descripcion', 'profesor', 'acciones'];

  // Estado de cada tabla por separado: que falle una no debe borrar la otra.
  readonly cargandoUsuarios = signal(false);
  readonly cargandoCursos = signal(false);
  readonly errorUsuarios = signal('');
  readonly errorCursos = signal('');

  // Paginación de las dos tablas
  tamPagina = 20;
  readonly pagUsuarios = signal(1);
  readonly pagCursos = signal(1);
  readonly totalUsuarios = signal(0);
  readonly totalCursos = signal(0);

  /** Cursos para el selector de "asignar profesor" (no es la página visible). */
  cursosOpt: Curso[] = [];

  /** ID del curso que se está eliminando (para deshabilitar solo ese botón) */
  eliminandoId: string | null = null;

  /** 🔢 Umbral para considerar descripción “larga” y compactar acciones */

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.cargarTodo();
  }

  /** Convierte ObjectId|string a string siempre */
  /**
   * `profesor` puede llegar como id o como objeto poblado, según el endpoint.
   * En la tabla no se nota porque `matCellDef` no tipa la fila; en la lista de
   * tarjetas sí, así que resolvemos el nombre en un solo sitio.
   */
  nombreProfesor(curso: Curso): string {
    const p = curso?.profesor;
    // Un identificador suelto no sirve para escribir un nombre: si el
    // backend no lo pobló, no lo sabemos.
    if (!p || typeof p === 'string') return 'Sin profesor asignado';
    return p.nombre || 'Sin profesor asignado';
  }

  id(u: Partial<Usuario>): string {
    return idDe(u);
  }

  /** Reconstruye opciones para selects */
  private buildOptions() {
    this.profesoresOpt.set(
      this.profesores().map(p => ({
        _id: this.id(p),
        nombre: p.nombre,
        correo: p.correo,
      }))
    );
    this.estudiantesOpt.set(
      this.estudiantes().map(e => ({
        _id: this.id(e),
        nombre: e.nombre,
        correo: e.correo,
      }))
    );
  }

  cargarTodo() {
    this.cargarUsuarios(this.pagUsuarios());
    this.cargarCursos(this.pagCursos());
    this.cargarOpciones();
  }

  /** Tabla de usuarios: solo la página que se está mirando. */
  cargarUsuarios(pagina: number) {
    this.pagUsuarios.set(pagina);
    this.cargandoUsuarios.set(true);
    this.errorUsuarios.set('');

    this.api.listUsuariosPaginado(pagina, this.tamPagina).subscribe({
      next: p => {
        this.usuarios.set(p.items);
        this.totalUsuarios.set(p.total);
        this.cargandoUsuarios.set(false);
      },
      error: err => {
        // Un snackbar se va solo a los 2,5 s y deja una tabla vacía que parece
        // "no hay usuarios". El error tiene que quedarse en pantalla.
        this.cargandoUsuarios.set(false);
        this.errorUsuarios.set(mensajeDeError(err, 'No se pudieron cargar los usuarios'));
      },
    });
  }

  /** Tabla de cursos: ídem. */
  cargarCursos(pagina: number) {
    this.pagCursos.set(pagina);
    this.cargandoCursos.set(true);
    this.errorCursos.set('');

    this.api.listCursosPaginado(pagina, this.tamPagina).subscribe({
      next: p => {
        this.cursos.set(p.items);
        this.totalCursos.set(p.total);
        this.cargandoCursos.set(false);
      },
      error: err => {
        this.cargandoCursos.set(false);
        this.errorCursos.set(mensajeDeError(err, 'No se pudieron cargar los cursos'));
      },
    });
  }

  /**
   * Opciones de los desplegables (asignar profesor, matricular estudiante).
   *
   * Van por su cuenta y filtradas por rol en el servidor: si se derivaran de la
   * tabla, al paginar los desplegables solo verían a quien cayera en la página
   * actual. También el listado de cursos del selector, por lo mismo.
   */
  /**
   * Opciones de los desplegables que SÍ se ven al entrar: el selector de
   * profesor de la sección "asignar" y el de curso.
   *
   * La lista de estudiantes no está aquí a propósito: solo la usa el diálogo
   * de matricular, y pedirla al cargar la página era una petición de cien
   * usuarios que la mayoría de las visitas no llega a usar.
   */
  private cargarOpciones() {
    this.api.listUsuariosPorRol('profesor').subscribe(us => {
      this.profesores.set(us);
      this.buildOptions();
    });
    this.api.listCursos().subscribe(cs => (this.cursosOpt = cs));
  }

  // Handlers del paginador de Material
  onPaginaUsuarios(e: PageEvent) {
    this.tamPagina = e.pageSize;
    this.cargarUsuarios(e.pageIndex + 1);
  }

  onPaginaCursos(e: PageEvent) {
    this.tamPagina = e.pageSize;
    this.cargarCursos(e.pageIndex + 1);
  }

  // ================== CURSOS: CREAR ==================
  abrirDialogNuevoCurso() {
    this.dialog
      .open(CourseCreateDialogComponent, {
        width: '520px',
        data: { profesores: this.profesoresOpt(), soyAdmin: true },
      })
      .afterClosed()
      .subscribe((data?: { titulo: string; descripcion: string; profesor?: string | null }) => {
        if (!data) return;
        const profesorId = (data.profesor ?? '').toString();
        if (!profesorId) {
          this.snack.open('Selecciona un profesor', 'Cerrar', { duration: 2000 });
          return;
        }
        this.api
          .createCursoAdmin({
            titulo: data.titulo,
            descripcion: data.descripcion,
            profesor: profesorId,
          })
          .subscribe({
            next: () => {
              this.snack.open('Curso creado', 'OK', { duration: 2000 });
              this.cargarTodo();
            },
            error: e =>
              this.snack.open(e?.error?.msg || 'No se pudo crear', 'Cerrar', { duration: 3000 }),
          });
      });
  }

  // ================== CURSOS: EDITAR ==================
  abrirDialogEditarCurso(curso: Curso) {
    const profesorId = idDe(curso.profesor);

    this.dialog
      .open(CourseCreateDialogComponent, {
        width: '520px',
        data: {
          profesores: this.profesoresOpt(),
          soyAdmin: true,
          initial: {
            titulo: curso.titulo,
            descripcion: curso.descripcion,
            profesorId,
          },
        },
      })
      .afterClosed()
      .subscribe((data?: { titulo: string; descripcion: string; profesor?: string | null }) => {
        if (!data) return;
        const profId = (data.profesor ?? '').toString();
        if (!profId) {
          this.snack.open('Selecciona un profesor', 'Cerrar', { duration: 2000 });
          return;
        }
        const payload: Partial<Curso> = {
          titulo: data.titulo,
          descripcion: data.descripcion,
          profesor: profId,
        };

        // Antes esto era un ternario sobre `(this.api as any).updateCursoAdmin`,
        // un método que nunca ha existido: la rama verdadera era inalcanzable.
        this.api.updateCurso(curso._id!, payload).subscribe({
          next: () => {
            this.snack.open('Curso actualizado', 'OK', { duration: 2000 });
            this.cargarTodo();
          },
          error: e =>
            this.snack.open(mensajeDeError(e, 'No se pudo actualizar'), 'Cerrar', {
              duration: 3000,
            }),
        });
      });
  }

  // ======== MATRICULAR (Asignar materia) POR CURSO ========
  abrirDialogMatricular(curso: Curso) {
    // Los estudiantes se piden ahora, no al cargar la página. Si ya se
    // pidieron antes, se reutilizan.
    const estudiantes$ = this.estudiantesOpt().length
      ? of(this.estudiantesOpt())
      : this.api.listUsuariosPorRol('estudiante').pipe(
          tap(us => {
            this.estudiantes.set(us);
            this.buildOptions();
          }),
          map(() => this.estudiantesOpt())
        );

    estudiantes$.subscribe(estudiantes => this.abrirMatricular(curso, estudiantes));
  }

  private abrirMatricular(
    curso: Curso,
    estudiantes: Array<{ _id: string; nombre: string; correo: string }>
  ) {
    this.dialog
      .open(EnrollStudentDialogComponent, {
        width: '460px',
        data: {
          cursoTitulo: curso.titulo,
          estudiantes, // ids en string
        },
      })
      .afterClosed()
      .subscribe((estudianteId?: string) => {
        if (!estudianteId) return; // cancelado
        this.api
          .createInscripcion({ curso: String(curso._id), estudiante: estudianteId })
          .subscribe({
            next: () => this.snack.open('Estudiante matriculado', 'OK', { duration: 1800 }),
            error: e =>
              this.snack.open(e?.error?.msg || 'No se pudo matricular', 'Cerrar', {
                duration: 3000,
              }),
          });
      });
  }

  // ======== ASIGNAR PROFESOR (acción rápida) ========
  onCursoSel(ev: MatSelectChange) {
    this.cursoCtrl.setValue(String(ev.value ?? ''));
  }
  onProfesorSel(ev: MatSelectChange) {
    this.profeCtrl.setValue(String(ev.value ?? ''));
  }

  asignarProfesor() {
    const curso = this.cursoCtrl.value;
    const prof = this.profeCtrl.value;

    if (!curso || !prof) {
      this.snack.open('Selecciona curso y profesor', 'Cerrar', { duration: 2000 });
      return;
    }
    this.isAssigning.set(true);

    this.api
      .asignarProfesor(curso, prof)
      .pipe(finalize(() => this.isAssigning.set(false)))
      .subscribe({
        next: () => {
          this.snack.open('Profesor asignado', 'OK', { duration: 1800 });
          this.cargarTodo();
          this.profeCtrl.setValue(null);
        },
        error: e =>
          this.snack.open(e?.error?.msg || 'No se pudo asignar', 'Cerrar', { duration: 3000 }),
      });
  }

  // ======== ROLES EN LOTE ========
  /**
   * Apunta un cambio de rol, sin guardarlo todavía.
   *
   * `update` y no mutar el objeto de dentro: escribir en el objeto que ya está
   * en la señal no avisa a nadie, así que con OnPush el chip seguía mostrando
   * el rol viejo hasta el siguiente clic en cualquier otra cosa.
   */
  onRolChange(u: Usuario, ev: MatSelectChange | Rol) {
    const value: Rol = typeof ev === 'string' ? ev : ev.value;
    const key = this.id(u);
    if (!key) return;

    this.pendingRoles.update(actual => {
      const siguiente = { ...actual };
      if (value === u.rol) delete siguiente[key];
      else siguiente[key] = value;
      return siguiente;
    });
  }

  tieneCambio(u: Usuario): boolean {
    const key = this.id(u);
    return !!(key && this.pendingRoles()[key] && this.pendingRoles()[key] !== u.rol);
  }

  /** El rol que hay que pintar: el pendiente si lo hay, si no el guardado. */
  rolMostrado(u: Usuario): string {
    return this.pendingRoles()[this.id(u)] ?? u.rol ?? '';
  }

  /* ---------- selección múltiple ---------- */

  /** Los que se pueden tocar: un admin no se edita desde esta tabla. */
  private editables(): Usuario[] {
    return this.usuarios().filter(u => u.rol !== 'admin');
  }

  alternarSeleccion(u: Usuario): void {
    const key = this.id(u);
    if (!key) return;

    this.seleccionados.update(actual => {
      const siguiente = new Set(actual);
      if (siguiente.has(key)) siguiente.delete(key);
      else siguiente.add(key);
      return siguiente;
    });
  }

  todosSeleccionados(): boolean {
    const posibles = this.editables();
    return posibles.length > 0 && posibles.every(u => this.seleccionados().has(this.id(u)));
  }

  /** Algunos sí y otros no: la casilla de la cabecera va en indeterminado. */
  algunoSeleccionado(): boolean {
    return this.seleccionados().size > 0 && !this.todosSeleccionados();
  }

  alternarTodos(): void {
    if (this.todosSeleccionados()) this.limpiarSeleccion();
    else this.seleccionados.set(new Set(this.editables().map(u => this.id(u))));
  }

  limpiarSeleccion(): void {
    this.seleccionados.set(new Set());
  }

  /**
   * Apunta el mismo rol para todos los seleccionados.
   *
   * No guarda: deja los cambios pendientes y los persiste el botón de
   * "Guardar N cambios" que ya existía. Así una acción en lote se puede
   * revisar antes de mandarla, igual que un cambio suelto.
   */
  asignarRolALaSeleccion(rol: Rol): void {
    const ids = this.seleccionados();
    for (const u of this.editables()) {
      if (ids.has(this.id(u))) this.onRolChange(u, rol);
    }
    this.limpiarSeleccion();
  }

  guardarTodos() {
    const entries = Object.entries(this.pendingRoles());
    if (!entries.length) return;

    this.savingBulk.set(true);

    const reqs = entries.map(([id, rol]) =>
      this.api.updateUsuario(id, { rol }).pipe(
        catchError(() => {
          this.snack.open(`Error actualizando usuario ${id}`, 'Cerrar', { duration: 2000 });
          return of(null);
        })
      )
    );

    forkJoin(reqs)
      .pipe(finalize(() => this.savingBulk.set(false)))
      .subscribe(() => {
        this.snack.open('Cambios guardados', 'OK', { duration: 1600 });
        this.pendingRoles.set({});
        this.limpiarSeleccion();
        this.cargarTodo();
      });
  }

  // ======== CURSOS: ELIMINAR (con diálogo Material) ========
  eliminarCurso(curso: Curso): void {
    if (!curso?._id) return;

    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Eliminar curso',
          message: `¿Eliminar el curso "${curso.titulo}"? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar',
          confirmColor: 'warn',
          cancelText: 'Cancelar',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean) => {
        if (!ok) return;

        this.eliminandoId = curso._id;

        this.api
          .deleteCurso(curso._id)
          .pipe(finalize(() => (this.eliminandoId = null)))
          .subscribe({
            next: () => {
              this.cursos.set(this.cursos().filter(c => c._id !== curso._id));
              this.snack.open('Curso eliminado', 'OK', { duration: 1800 });
            },
            error: e => {
              this.snack.open(mensajeDeError(e, 'No se pudo eliminar el curso.'), 'Cerrar', {
                duration: 3000,
              });
            },
          });
      });
  }

  // ========= helpers =========

  trackOpt = (_: number, item: { _id: string }) => item._id;

  get totalPendientes() {
    return Object.keys(this.pendingRoles()).length;
  }
}
