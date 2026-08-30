// src/app/app-routing-module.ts
// En apps standalone NO declaras NgModule aquí. Solo exporta `routes`.
// main.ts hace: provideRouter(routes)

import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';
import { AuthService } from './core/auth.service';
import { rutaInicioPara } from './core/rutas';

export const routes: Routes = [
  // ===== Públicas =====
  {
    // Portada: explica qué es esto antes de pedir credenciales. Con sesión
    // iniciada el propio componente redirige al panel que toca.
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },

  // ===== Profesor =====
  // 👉 ahora hay rutas propias para el rol profesor
  {
    path: 'profesor/dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profesor/professor-dashboard.component').then(
        m => m.ProfessorDashboardComponent
      ),
  },
  {
    path: 'profesor/clases',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profesor/professor-classes.component').then(
        m => m.ProfessorClassesComponent
      ),
  },
  // Alias para compatibilidad: /mis-clases -> /profesor/clases
  { path: 'mis-clases', redirectTo: 'profesor/clases', pathMatch: 'full' },

  // ===== Admin =====
  {
    path: 'admin',
    canActivate: [authGuard],
    // canMatch: el servidor confirma el rol antes de descargar el panel.
    canMatch: [adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
  },

  // ===== Estudiante =====
  {
    path: 'estudiante/inicio',
    canActivate: [authGuard],
    // El menú enlaza a `/dashboard`, que redirige aquí según el rol, así que
    // esta URL no coincide con ningún destino de la lista y la barra superior
    // se quedaba diciendo "EduControl" en la pantalla de inicio del
    // estudiante. Es exactamente el caso para el que existe `data.titulo`.
    data: { titulo: 'Inicio' },
    loadComponent: () =>
      import('./features/estudiante/student-dashboard.component').then(
        m => m.StudentDashboardComponent
      ),
  },
  {
    path: 'cursos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/estudiante/student-courses.component').then(
        m => m.StudentCoursesComponent
      ),
  },
  // ===== Ficha de curso =====
  // La ven los tres roles y enseña cosas distintas a cada uno, así que no vive
  // bajo ninguno. Qué puede ver cada quien lo decide el servidor, no la ruta.
  {
    path: 'cursos/:id',
    canActivate: [authGuard],
    // La barra superior toma su título de la navegación, y esta pantalla no es
    // un destino del menú: sin esto decía "EduControl" en la ficha de un curso.
    data: { titulo: 'Curso' },
    loadComponent: () =>
      import('./features/curso/curso-detalle.component').then(m => m.CursoDetalleComponent),
  },

  {
    path: 'mis-cursos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/estudiante/student-my-courses.component').then(
        m => m.StudentMyCoursesComponent
      ),
  },

  // ===== Mi cuenta =====
  // Sustituye a 'elige-rol': datos, contraseña y activación del perfil de
  // profesor. Cambiar de rol es una acción puntual, no un destino permanente.
  {
    path: 'cuenta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/cuenta/mi-cuenta.component').then(m => m.MiCuentaComponent),
  },
  // Alias: los enlaces antiguos siguen funcionando.
  { path: 'elige-rol', redirectTo: 'cuenta', pathMatch: 'full' },

  // ===== /dashboard: redirección por rol =====
  // Antes esto cargaba un DashboardComponent cuyo único trabajo era mirar el rol
  // y renderizar uno de otros tres componentes. Un conmutador no es una pantalla:
  // la decisión es de enrutado, así que vive en el router y no monta nada.
  // Se mantiene la ruta porque hay enlaces y marcadores que apuntan aquí.
  {
    path: 'dashboard',
    canActivate: [authGuard],
    redirectTo: () => rutaInicioPara(inject(AuthService).rol()),
  },

  // ===== 404 =====
  // Comodín real, no una redirección silenciosa a /dashboard.
  {
    path: '**',
    loadComponent: () => import('./shared/not-found.component').then(m => m.NotFoundComponent),
  },
];

// ⚠️ Nada más. No exportes AppRoutingModule (no hay NgModule).
