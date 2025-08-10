// src/app/dashboard/dashboard.component.ts
// -----------------------------------------------------------------------------
// Contenedor "tonto" de Dashboard por rol.
// - Admin  -> muestra <app-admin-dashboard>
// - Profe  -> muestra <app-mis-clases>
// - Estud. -> muestra <app-student-dashboard> (saludo + cursos matriculados)
// -----------------------------------------------------------------------------

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/auth.service';

// Reutilizamos tus componentes standalone existentes:
import { AdminDashboardComponent } from '../admin/admin-dashboard.component';
import { MisClasesComponent } from '../mis-clases/mis-clases.component';
import { StudentDashboardComponent } from '../student/student-dashboard.component';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    AdminDashboardComponent, // vista completa de administración
    MisClasesComponent,      // vista de profesor
    StudentDashboardComponent // ✅ nueva vista de estudiante
  ],
  template: `
    <!-- Si todavía no tenemos el usuario, no renderizamos nada (o podrías poner un spinner) -->
    <ng-container *ngIf="auth.usuario as u">
      <ng-container [ngSwitch]="u.rol">
        <!-- Admin: panel completo -->
        <app-admin-dashboard *ngSwitchCase="'admin'"></app-admin-dashboard>

        <!-- Profesor: sus clases -->
        <app-mis-clases *ngSwitchCase="'profesor'"></app-mis-clases>

        <!-- Estudiante (default) -->
        <app-student-dashboard *ngSwitchDefault></app-student-dashboard>
      </ng-container>
    </ng-container>
  `
})
export class DashboardComponent {
  constructor(public auth: AuthService) {}
}