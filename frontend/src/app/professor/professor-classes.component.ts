// src/app/professor/professor-classes.component.ts
// -------------------------------------------------------------------
// Los cursos que imparte el profesor, con sus alumnos inscritos.
//
// Este componente tenía 314 líneas defendiéndose de un backend desconocido:
// toleraba cuatro nombres para el campo curso, ocho para el alumno y cuatro
// para los identificadores, y si `/api/inscripciones` venía vacío probaba siete
// endpoints a ciegas. Contrastados contra las rutas reales, ninguno servía:
// `/api/matriculas`, `/api/cursos/:id/inscripciones` y `/api/cursos/:id/estudiantes`
// no existen (404), y las variantes con query string sí existen pero el
// controlador hace `Inscripcion.find()` sin leer `req.query`, así que devolvían
// la colección entera ignorando el filtro.
//
// El contrato real es conocido y está en este mismo repositorio:
//   GET /api/inscripciones -> { ok, inscripciones: [{ estudiante, curso, fecha }] }
// con `estudiante` y `curso` POBLADOS por Mongoose. No hace falta cruzar nada
// con la lista de usuarios: la inscripción ya trae el alumno dentro.
// -------------------------------------------------------------------

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Curso } from '../models/curso.model';
import { Usuario } from '../models/usuario.model';
import { EstadoVistaComponent } from '../shared/estado-vista.component';
import { mensajeDeError } from '../core/http-error';

@Component({
  standalone: true,
  selector: 'app-professor-classes',
  imports: [
    CommonModule,
    MatCardModule, MatIconModule, MatButtonModule, MatDividerModule,
    MatTableModule,
    EstadoVistaComponent
  ],
  template: `
  <div class="wrap">

    <mat-card class="brand">
      <div class="brand-wrap">
        <div>
          <h1>Mis clases</h1>
          <span *ngIf="auth.usuario?.nombre">Profesor: {{ auth.usuario?.nombre }}</span>
        </div>
      </div>
    </mat-card>

    <app-estado-vista
      *ngIf="loading || error || !cursos.length"
      [cargando]="loading"
      [error]="error"
      mensajeVacio="Todavía no tienes cursos asignados. Administración te los asigna."
      iconoVacio="menu_book"
      (reintentar)="cargar()">
    </app-estado-vista>

    <ng-container *ngIf="!loading && !error && cursos.length">
      <div class="cards">
        <mat-card class="course" *ngFor="let c of cursos; trackBy: trackCurso">
          <mat-card-title>{{ c.titulo }}</mat-card-title>
          <mat-card-subtitle>{{ c.descripcion || '—' }}</mat-card-subtitle>

          <mat-divider></mat-divider>

          <div *ngIf="(alumnos.get(idOf(c)) || []).length; else noAlumnos" class="table-wrap">
            <table mat-table [dataSource]="alumnos.get(idOf(c))!">
              <ng-container matColumnDef="nombre">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let e">{{ e.nombre }}</td>
              </ng-container>

              <ng-container matColumnDef="correo">
                <th mat-header-cell *matHeaderCellDef>Correo</th>
                <td mat-cell *matCellDef="let e">{{ e.correo }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols;"></tr>
            </table>
          </div>

          <ng-template #noAlumnos>
            <div class="empty">
              <mat-icon>info</mat-icon>
              Aún no hay estudiantes inscritos.
            </div>
          </ng-template>
        </mat-card>
      </div>
    </ng-container>

  </div>
  `,
  styles: [`
    .wrap{ display:grid; gap:16px; padding:0 4px }
    .brand .brand-wrap{ display:flex; align-items:center; justify-content:space-between }
    .brand h1{ margin:0 }
    .cards{ display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px }
    .course{ min-height:140px; border-radius: 16px; }
    .table-wrap{ overflow:auto; margin-top:8px }
    table{ width:100% }
    .empty{ opacity:.7; display:flex; align-items:center; gap:8px; padding:6px 0 }
  `]
})
export class ProfessorClassesComponent implements OnInit {
  private api = inject(ApiService);
  public auth = inject(AuthService);

  loading = false;
  error = '';
  cursos: Curso[] = [];
  /** cursoId -> alumnos inscritos */
  alumnos = new Map<string, Usuario[]>();
  cols = ['nombre', 'correo'];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = '';

    forkJoin({
      // Los cursos son el dato esencial: si esa llamada falla hay que decirlo,
      // no fingir una lista vacía.
      cursos: this.api.listCursosDeProfesorMe(),
      // Las inscripciones sí toleran fallo: sin ellas se ven los cursos pero
      // sin alumnos, que es peor que nada pero mejor que una pantalla vacía.
      ins: this.api.listInscripciones().pipe(catchError(() => of([] as any[])))
    }).subscribe({
      next: ({ cursos, ins }) => {
        this.cursos = cursos || [];
        this.alumnos = this.agruparAlumnosPorCurso(ins || []);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.cursos = [];
        this.error = mensajeDeError(err, 'No se pudieron cargar tus clases');
      }
    });
  }

  /** Id de un documento que puede venir como objeto poblado o como string. */
  idOf(x: any): string {
    return typeof x === 'string' ? x : (x?._id ?? x?.id ?? '');
  }

  /**
   * Agrupa las inscripciones por curso.
   * `estudiante` y `curso` vienen poblados desde el backend, así que aquí no se
   * resuelve ninguna referencia: solo se agrupa.
   */
  private agruparAlumnosPorCurso(ins: any[]): Map<string, Usuario[]> {
    const porCurso = new Map<string, Usuario[]>();

    for (const i of ins) {
      const cursoId = this.idOf(i?.curso);
      const alumno: Usuario | null = i?.estudiante ?? null;
      if (!cursoId || !alumno) continue;

      const lista = porCurso.get(cursoId) ?? [];
      // Una inscripción duplicada no debería existir (hay índice único en el
      // modelo), pero si llegara no la pintamos dos veces.
      if (!lista.some(u => this.idOf(u) === this.idOf(alumno))) lista.push(alumno);
      porCurso.set(cursoId, lista);
    }

    return porCurso;
  }

  trackCurso = (_: number, c: Curso) => this.idOf(c);
}
