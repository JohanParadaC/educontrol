import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, switchMap, map } from 'rxjs';

import { ApiService } from '../core/api.service';
import { Curso } from '../models/curso.model';

type Inscripcion = { _id: string; curso: string | Curso; progreso?: number; promedio?: number; };

@Component({
  standalone: true,
  selector: 'app-student-my-courses',
  imports: [ CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatProgressBarModule ],
  template: `
  <div class="grid gap-3">
    <ng-container *ngIf="inscripciones.length; else empty">
      <mat-card class="course" *ngFor="let i of inscripciones; trackBy: trackIns">
        <div class="head">
          <div>
            <h3>{{ courseTitle(i.curso) }}</h3>
            <div class="muted">{{ courseProfesor(i.curso) || '—' }}</div>
          </div>
          <div class="head-actions">
            <button mat-stroked-button color="primary" (click)="irAlCurso(i)">
              <mat-icon>open_in_new</mat-icon> Ir al curso
            </button>
            <button mat-stroked-button color="warn" (click)="desmatricular(i)">
              <mat-icon>cancel</mat-icon> Cancelar
            </button>
          </div>
        </div>

        <div class="progress" *ngIf="i.progreso != null">
          <mat-progress-bar [value]="i.progreso"></mat-progress-bar>
          <span>{{ i.progreso }}% completado</span>
        </div>
      </mat-card>
    </ng-container>

    <ng-template #empty>
      <div class="empty">
        <mat-icon>info</mat-icon>
        Aún no tienes cursos. <a routerLink="/cursos">Explora el catálogo</a>
      </div>
    </ng-template>
  </div>
  `,
  styles: [`
    .grid{display:grid}.gap-3{gap:12px}.course{padding:12px}
    .head{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .muted{opacity:.7}.head-actions button{margin-left:8px}
    .progress{margin-top:8px;display:flex;align-items:center;gap:8px}
    .empty{opacity:.7;display:flex;align-items:center;gap:8px}
  `]
})
export class StudentMyCoursesComponent implements OnInit {
  private api = inject(ApiService) as any;
  private snack = inject(MatSnackBar);

  inscripciones: Inscripcion[] = [];

  ngOnInit() { this.cargar(); }

  cargar() {
    const api: any = this.api;
    if (api.listMisInscripciones) {
      api.listMisInscripciones().subscribe((ins: Inscripcion[]) => this.inscripciones = ins || []);
    } else if (api.listInscripcionesMe) {
      api.listInscripcionesMe().subscribe((ins: Inscripcion[]) => this.inscripciones = ins || []);
    } else if (api.listInscripciones && api.me) {
      api.me().pipe(
        switchMap((me: any) => api.listInscripciones().pipe(
          map((all: any[]) => (all || []).filter(i => {
            const estId = i?.estudiante?._id || i?.estudiante || '';
            return String(estId) === String(me?._id || me?.id || '');
          }))
        ))
      ).subscribe((ins: Inscripcion[]) => this.inscripciones = ins || []);
    }
  }

  irAlCurso(i: Inscripcion) {
    this.snack.open('Navegación al curso próximamente 😉', 'Cerrar', { duration: 1500 });
  }

  desmatricular(i: Inscripcion) {
    if (this.api.deleteInscripcion) {
      this.api.deleteInscripcion(i._id).subscribe({
        next: () => { this.snack.open('Matrícula cancelada', 'OK', { duration: 1500 }); this.cargar(); },
        error: (e: any) => this.snack.open(e?.error?.msg || 'No se pudo cancelar', 'Cerrar', { duration: 2500 })
      });
    } else {
      this.snack.open('Tu API no expone endpoint para cancelar matrícula.', 'Cerrar', { duration: 2500 });
    }
  }

  // helpers seguros para string | Curso
  courseTitle(c: string | Curso){ return typeof c === 'string' ? c : c?.titulo || '—'; }
  courseProfesor(c: string | Curso){ return typeof c === 'string' ? '' : (typeof c.profesor === 'string' ? '' : (c.profesor?.nombre || '')); }
  trackIns = (_: number, i: Inscripcion) => i._id;
}