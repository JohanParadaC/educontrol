// src/app/app-routing-module.ts
// En apps standalone NO declaras NgModule aquí. Solo exporta `routes`.
// main.ts hace: provideRouter(routes)

import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth.guard';
import { AdminGuard } from './core/admin.guard';

export const routes: Routes = [
  // ===== Públicas =====
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./auth/register/register.component').then(m => m.RegisterComponent),
  },

  // ===== Profesor =====
  // 👉 ahora hay rutas propias para el rol profesor
  {
    path: 'profesor/dashboard',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./professor/professor-dashboard.component')
        .then(m => m.ProfessorDashboardComponent),
  },
  {
    path: 'profesor/clases',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./professor/professor-classes.component')
        .then(m => m.ProfessorClassesComponent),
  },
  // Alias para compatibilidad: /mis-clases -> /profesor/clases
  { path: 'mis-clases', redirectTo: 'profesor/clases', pathMatch: 'full' },

  // ===== Dashboard genérico (alumno/neutral) =====
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },

  // ===== Admin =====
  {
    path: 'admin',
    canActivate: [AuthGuard, AdminGuard],
    loadComponent: () =>
      import('./admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
  },

  // ===== Estudiante (ajusta paths si usas otros) =====
  {
    path: 'cursos',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./student/student-courses.component').then(m => m.StudentCoursesComponent),
  },
  {
    path: 'mis-cursos',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./student/student-my-courses.component').then(m => m.StudentMyCoursesComponent),
  },

  // ===== Elegir rol =====
  {
    path: 'elige-rol',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./role-select/role-select.component').then(m => m.RoleSelectComponent),
  },

  // ===== Redirecciones =====
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];

// ⚠️ Nada más. No exportes AppRoutingModule (no hay NgModule).