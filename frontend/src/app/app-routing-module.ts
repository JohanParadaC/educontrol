// src/app/app-routing-module.ts
// En apps standalone NO declaras NgModule aquí. Solo exporta `routes`.
// main.ts hace: provideRouter(routes)

import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth.guard';
import { AdminGuard } from './core/admin.guard';

export const routes: Routes = [
  // ===== Públicas =====
  {
    // Portada: explica qué es esto antes de pedir credenciales. Con sesión
    // iniciada el propio componente redirige al panel que toca.
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./landing/landing.component').then(m => m.LandingComponent),
  },
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

  // ===== Mi cuenta =====
  // Sustituye a 'elige-rol': datos, contraseña y activación del perfil de
  // profesor. Cambiar de rol es una acción puntual, no un destino permanente.
  {
    path: 'cuenta',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./cuenta/mi-cuenta.component').then(m => m.MiCuentaComponent),
  },
  // Alias: los enlaces antiguos siguen funcionando.
  { path: 'elige-rol', redirectTo: 'cuenta', pathMatch: 'full' },

  // ===== 404 =====
  // Comodín real, no una redirección silenciosa a /dashboard.
  {
    path: '**',
    loadComponent: () =>
      import('./shared/not-found.component').then(m => m.NotFoundComponent),
  },
];

// ⚠️ Nada más. No exportes AppRoutingModule (no hay NgModule).