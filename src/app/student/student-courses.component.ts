// src/app/student/student-courses.component.ts
// Catálogo de cursos (búsqueda + auto-matrícula con ApiService.enrollMe).

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // ✅ módulo incluido
import {
  BehaviorSubject,
  of,
  combineLatest,
  startWith,
  map,
  switchMap,
  Observable,
} from 'rxjs';

import { ApiService } from '../core/api.service';
import { Curso } from '../models/curso.model';

type Inscripcion = { _id: string; curso: string | Curso; estudiante?: any; cursoId?: string };

@Component({
  standalone: true,
  selector: 'app-student-courses',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule // ✅
  ],
  template: `
  <div class="grid gap-3">
    <div class="toolbar">
      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Buscar curso</mat-label>
        <input matInput [formControl]="q" placeholder="Título, profesor, descripción…">
      </mat-form-field>
    </div>

    <div class="grid cards">
      <mat-card *ngFor="let c of filtered | async; trackBy: trackCurso" class="course">
        <h3>{{ c.titulo }}</h3>
        <div class="muted">{{ profName(c.profesor) || '—' }}</div>
        <p class="desc">{{ c.descripcion }}</p>

        <div class="actions">
          <button mat-stroked-button color="primary"
                  [disabled]="isEnrolled(c._id!)"
                  (click)="matricular(c)">
            <mat-icon>how_to_reg</mat-icon>
            {{ isEnrolled(c._id!) ? 'Ya inscrito' : 'Matricular' }}
          </button>
        </div>
      </mat-card>
    </div>

    <div *ngIf="(filtered | async)?.length === 0" class="empty">
      <mat-icon>info</mat-icon> No se encontraron cursos.
    </div>
  </div>
  `,
  styles: [`
    .grid{display:grid}.gap-3{gap:12px}.toolbar{max-width:560px}
    .cards{grid-template-columns:repeat(3,1fr);gap:16px}
    .course h3{margin-bottom:4px}.muted{opacity:.7}.desc{opacity:.85}
    .actions{margin-top:8px}
    .empty{opacity:.7;display:flex;align-items:center;gap:8px}
    @media (max-width:1100px){.cards{grid-template-columns:repeat(2,1fr)}}
    @media (max-width:700px){.cards{grid-template-columns:1fr}}
  `]
})
export class StudentCoursesComponent implements OnInit {
  private api = inject(ApiService) as any;
  private snack = inject(MatSnackBar);

  private cursos$ = new BehaviorSubject<Curso[]>([]);
  cursos: Curso[] = [];
  inscripciones: Inscripcion[] = [];

  q = new FormControl<string>('', { nonNullable: true });

  filtered = combineLatest([
    this.q.valueChanges.pipe(startWith('')),
    this.cursos$
  ]).pipe(
    map(([q, cursos]) => this.filterCourses(cursos, q))
  );

  ngOnInit() {
    // Catálogo
    (this.api.listCursos?.() ?? this.api.getCursos?.() ?? of<Curso[]>([]))
      .subscribe((cs: Curso[]) => {
        this.cursos = cs || [];
        this.cursos$.next(this.cursos);
      });

    // Mis inscripciones
    this.getMyEnrollments().subscribe((ins: Inscripcion[]) => {
      this.inscripciones = ins || [];
    });
  }

  profName(p: any): string { return typeof p === 'string' ? '' : (p?.nombre || ''); }

  filterCourses(cursos: Curso[], q: string): Curso[] {
    const s = (q || '').trim().toLowerCase();
    if (!s) return cursos;
    return cursos.filter(c =>
      c.titulo?.toLowerCase().includes(s) ||
      c.descripcion?.toLowerCase().includes(s) ||
      this.profName(c.profesor).toLowerCase().includes(s)
    );
  }

  isEnrolled(cursoId: string): boolean {
    return this.inscripciones.some(i => (typeof i.curso === 'string' ? i.curso : i.curso?._id) === cursoId);
  }

  // ✅ Usa enrollMe; sin snackbar viejo
  matricular(c: Curso) {
    const id = c._id!;
    (this.api.enrollMe?.(id) as Observable<any>).subscribe({
      next: () => {
        this.snack.open('¡Matriculado con éxito!', 'OK', { duration: 2000 });
        // refrescar inscripciones locales
        this.getMyEnrollments().subscribe((ins: Inscripcion[]) => this.inscripciones = ins || []);
      },
      error: (e: any) =>
        this.snack.open(e?.error?.msg || 'No se pudo matricular', 'Cerrar', { duration: 3000 })
    });
  }

  // ✅ Tipado explícito
  private getMyEnrollments(): Observable<Inscripcion[]> {
    const api: any = this.api;
    if (api.listMisInscripciones) return api.listMisInscripciones();
    if (api.listInscripcionesMe) return api.listInscripcionesMe();
    if (api.listInscripciones && api.me) {
      return api.me().pipe(
        switchMap((me: any) => api.listInscripciones().pipe(
          map((all: Inscripcion[]) => (all || []).filter(i => {
            const estId = (i as any).estudiante?._id || (i as any).estudiante || '';
            return String(estId) === String(me?._id || me?.id || '');
          }))
        ))
      );
    }
    return of<Inscripcion[]>([]);
  }

  trackCurso = (_: number, c: Curso) => c._id!;
}
