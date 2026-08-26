// src/app/landing/landing.component.ts
// ---------------------------------------------------------------------------
// Página pública de entrada.
//
// Antes '' redirigía directo a /dashboard y, sin sesión, lo primero que veías
// era un formulario de login sin contexto: nada decía qué es esto ni para quién.
// Quien entra tiene que poder responderse "¿qué es y me sirve?" antes de decidir
// si se molesta en entrar.
// ---------------------------------------------------------------------------
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

import { AuthService } from '../../core/auth.service';
import { rutaInicioPara } from '../../core/rutas';

@Component({
  standalone: true,
  selector: 'app-landing',
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatCardModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly perfiles = [
    {
      icono: 'school',
      titulo: 'Estudiantes',
      texto: 'Busca en el catálogo, matricúlate y consulta en qué cursos estás.'
    },
    {
      icono: 'groups',
      titulo: 'Profesores',
      texto: 'Consulta los cursos que impartes y quién se ha matriculado en ellos.'
    },
    {
      icono: 'admin_panel_settings',
      titulo: 'Administración',
      texto: 'Gestiona usuarios y roles, crea cursos, asigna profesores y matricula alumnos.'
    }
  ];

  constructor() {
    // Con sesión iniciada esta página no aporta nada: al panel directamente.
    if (this.auth.isLoggedIn) {
      const rol = this.auth.usuario?.rol;
      this.router.navigateByUrl(rutaInicioPara(rol));
    }
  }
}
