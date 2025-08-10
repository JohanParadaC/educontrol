// src/app/admin/admin-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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

import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ApiService } from '../core/api.service';
import { Usuario } from '../models/usuario.model';
import { Curso } from '../models/curso.model';
import { CourseCreateDialogComponent } from './course-create-dialog.component';
import { EnrollStudentDialogComponent } from './enroll-student-dialog.component';

// diálogo de confirmación propio (standalone)
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

type Rol = 'estudiante' | 'profesor';

@Component({
  standalone: true,
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule, MatTableModule, MatSelectModule, MatFormFieldModule,
    MatButtonModule, MatIconModule, MatTooltipModule // ✅ NUEVO
  ]
})
export class AdminDashboardComponent implements OnInit {

  usuarios: Usuario[] = [];
  profesores: Usuario[] = [];
  estudiantes: Usuario[] = [];
  cursos: Curso[] = [];

  // Opciones planas para selects (ID ya normalizado a string)
  profesoresOpt: Array<{ _id: string; nombre: string; correo: string }> = [];
  estudiantesOpt: Array<{ _id: string; nombre: string; correo: string }> = [];

  // Controles rápidos para "Asignar profesor"
  cursoCtrl  = new FormControl<string | null>(null);
  profeCtrl  = new FormControl<string | null>(null);

  isAssigning = false;

  // Cambios de rol en lote
  pendingRoles: Record<string, Rol> = {};
  savingBulk = false;

  displayedUserCols = ['_id', 'nombre', 'correo', 'rol', 'acciones'];
  displayedCourseCols = ['_id', 'titulo', 'descripcion', 'profesor', 'acciones'];

  loading = false;

  /** ID del curso que se está eliminando (para deshabilitar solo ese botón) */
  eliminandoId: string | null = null;

  /** 🔢 Umbral para considerar descripción “larga” y compactar acciones */
  private readonly DESC_LARGA = 200; // ✅ NUEVO

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.cargarTodo();
  }

  /** Convierte ObjectId|string a string siempre */
  id(u: Partial<Usuario>): string {
    const anyId = (u as any)?._id ?? (u as any)?.id ?? '';
    return typeof anyId === 'string' ? anyId : anyId?.toString?.() ?? '';
  }

  /** Reconstruye opciones para selects */
  private buildOptions() {
    this.profesoresOpt = this.profesores.map(p => ({
      _id: this.id(p), nombre: p.nombre, correo: p.correo
    }));
    this.estudiantesOpt = this.estudiantes.map(e => ({
      _id: this.id(e), nombre: e.nombre, correo: e.correo
    }));
  }

  cargarTodo() {
    this.loading = true;

    // Usuarios → derive profesores/estudiantes → opciones planas
    this.api.listUsuarios().subscribe({
      next: (us) => {
        this.usuarios = us;
        this.profesores  = us.filter(u => u.rol === 'profesor');
        this.estudiantes = us.filter(u => u.rol === 'estudiante');
        this.buildOptions();
      },
      error: () => this.snack.open('No se pudieron cargar usuarios', 'Cerrar', { duration: 2500 })
    });

    // Cursos
    this.api.listCursos().subscribe({
      next: (cs) => { this.cursos = cs; this.loading = false; },
      error: () => { this.loading = false; this.snack.open('No se pudieron cargar cursos', 'Cerrar', { duration: 2500 }); }
    });
  }

  // ================== CURSOS: CREAR ==================
  abrirDialogNuevoCurso() {
    this.dialog.open(CourseCreateDialogComponent, {
      width: '520px',
      data: { profesores: this.profesoresOpt, soyAdmin: true }
    })
    .afterClosed()
    .subscribe((data?: { titulo: string; descripcion: string; profesor?: string | null }) => {
      if (!data) return;
      const profesorId = (data.profesor ?? '').toString();
      if (!profesorId) {
        this.snack.open('Selecciona un profesor', 'Cerrar', { duration: 2000 });
        return;
      }
      const payload = { titulo: data.titulo, descripcion: data.descripcion, profesor: profesorId } as any;

      this.api.createCursoAdmin(payload).subscribe({
        next: () => { this.snack.open('Curso creado', 'OK', { duration: 2000 }); this.cargarTodo(); },
        error: (e) => this.snack.open(e?.error?.msg || 'No se pudo crear', 'Cerrar', { duration: 3000 })
      });
    });
  }

  // ================== CURSOS: EDITAR ==================
  abrirDialogEditarCurso(curso: Curso) {
    const p: any = (curso as any).profesor;
    const profesorId = typeof p === 'string' ? p : (p && p._id ? String(p._id) : '');

    this.dialog.open(CourseCreateDialogComponent, {
      width: '520px',
      data: {
        profesores: this.profesoresOpt,
        soyAdmin: true,
        initial: {
          titulo: curso.titulo,
          descripcion: curso.descripcion,
          profesorId
        }
      }
    })
    .afterClosed()
    .subscribe((data?: { titulo: string; descripcion: string; profesor?: string | null }) => {
      if (!data) return;
      const profId = (data.profesor ?? '').toString();
      if (!profId) {
        this.snack.open('Selecciona un profesor', 'Cerrar', { duration: 2000 });
        return;
      }
      const payload = { titulo: data.titulo, descripcion: data.descripcion, profesor: profId } as any;

      (this.api as any).updateCursoAdmin
        ? (this.api as any).updateCursoAdmin(curso._id!, payload).subscribe({
            next: () => { this.snack.open('Curso actualizado', 'OK', { duration: 2000 }); this.cargarTodo(); },
            error: (e: any) => this.snack.open(e?.error?.msg || 'No se pudo actualizar', 'Cerrar', { duration: 3000 })
          })
        : this.api.updateCurso(curso._id!, payload).subscribe({
            next: () => { this.snack.open('Curso actualizado', 'OK', { duration: 2000 }); this.cargarTodo(); },
            error: (e) => this.snack.open((e as any)?.error?.msg || 'No se pudo actualizar', 'Cerrar', { duration: 3000 })
          });
    });
  }

  // ======== MATRICULAR (Asignar materia) POR CURSO ========
  abrirDialogMatricular(curso: Curso) {
    this.dialog.open(EnrollStudentDialogComponent, {
      width: '460px',
      data: {
        cursoTitulo: curso.titulo,
        estudiantes: this.estudiantesOpt // ids en string
      }
    })
    .afterClosed()
    .subscribe((estudianteId?: string) => {
      if (!estudianteId) return; // cancelado
      this.api.createInscripcion({ curso: String(curso._id), estudiante: estudianteId })
        .subscribe({
          next: () => this.snack.open('Estudiante matriculado', 'OK', { duration: 1800 }),
          error: (e) => this.snack.open(e?.error?.msg || 'No se pudo matricular', 'Cerrar', { duration: 3000 })
        });
    });
  }

  // ======== ASIGNAR PROFESOR (acción rápida) ========
  onCursoSel(ev: MatSelectChange)    { this.cursoCtrl.setValue(String(ev.value ?? '')); }
  onProfesorSel(ev: MatSelectChange) { this.profeCtrl.setValue(String(ev.value ?? '')); }

  asignarProfesor() {
    const curso = this.cursoCtrl.value;
    const prof  = this.profeCtrl.value;

    if (!curso || !prof) {
      this.snack.open('Selecciona curso y profesor', 'Cerrar', { duration: 2000 });
      return;
    }
    this.isAssigning = true;

    this.api.asignarProfesor(curso, prof)
      .pipe(finalize(() => this.isAssigning = false))
      .subscribe({
        next: () => {
          this.snack.open('Profesor asignado', 'OK', { duration: 1800 });
          this.cargarTodo();
          this.profeCtrl.setValue(null);
        },
        error: (e) => this.snack.open(e?.error?.msg || 'No se pudo asignar', 'Cerrar', { duration: 3000 })
      });
  }

  // ======== ROLES EN LOTE ========
  onRolChange(u: Usuario, ev: MatSelectChange | Rol) {
    const value: Rol = typeof ev === 'string' ? ev : ev.value;
    const key = this.id(u);
    if (!key) return;
    if (value === u.rol) delete this.pendingRoles[key];
    else this.pendingRoles[key] = value;
  }

  tieneCambio(u: Usuario): boolean {
    const key = this.id(u);
    return !!(key && this.pendingRoles[key] && this.pendingRoles[key] !== u.rol);
  }

  guardarTodos() {
    const entries = Object.entries(this.pendingRoles);
    if (!entries.length) return;

    this.savingBulk = true;

    const reqs = entries.map(([id, rol]) =>
      this.api.updateUsuario(id, { rol }).pipe(
        catchError(() => { this.snack.open(`Error actualizando usuario ${id}`, 'Cerrar', { duration: 2000 }); return of(null); })
      )
    );

    forkJoin(reqs)
      .pipe(finalize(() => this.savingBulk = false))
      .subscribe(() => {
        this.snack.open('Cambios guardados', 'OK', { duration: 1600 });
        this.pendingRoles = {};
        this.cargarTodo();
      });
  }

  // ======== CURSOS: ELIMINAR (con diálogo Material) ========
  eliminarCurso(curso: Curso): void {
    if (!curso?._id) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Eliminar curso',
        message: `¿Eliminar el curso "${curso.titulo}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        confirmColor: 'warn',
        cancelText: 'Cancelar'
      }
    })
    .afterClosed()
    .subscribe((ok: boolean) => {
      if (!ok) return;

      this.eliminandoId = curso._id;

      this.api.deleteCurso(curso._id)
        .pipe(finalize(() => this.eliminandoId = null))
        .subscribe({
          next: () => {
            this.cursos = this.cursos.filter(c => c._id !== curso._id);
            this.snack.open('Curso eliminado', 'OK', { duration: 1800 });
          },
          error: (e) => {
            const msg = (e as any)?.error?.msg || 'No se pudo eliminar el curso';
            this.snack.open(msg, 'Cerrar', { duration: 3000 });
          }
        });
    });
  }

  // ========= helpers =========

  /** ✅ Si la descripción es larga o la ventana es estrecha, mostramos solo íconos */
  accionesCompactas(c: Curso): boolean {
    const len = (c?.descripcion || '').length;
    const estrecha = window.innerWidth < 1200;
    return len > this.DESC_LARGA || estrecha;
  }

  trackOpt = (_: number, item: { _id: string }) => item._id;

  get totalPendientes() {
    return Object.keys(this.pendingRoles).length;
  }
}