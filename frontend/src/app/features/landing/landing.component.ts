// src/app/features/landing/landing.component.ts
// ---------------------------------------------------------------------------
// Página pública de entrada.
//
// Antes '' redirigía directo a /dashboard y, sin sesión, lo primero que veías
// era un formulario de login sin contexto: nada decía qué es esto ni para quién.
// Quien entra tiene que poder responderse "¿qué es y me sirve?" antes de decidir
// si se molesta en entrar.
//
// La segunda versión ya lo contaba, pero lo contaba en texto centrado sobre
// fondo casi blanco: correcta y muda. Esta la organiza en cuatro respuestas —
// qué es (héroe), para quién (perfiles), cómo va (pasos) y cómo lo pruebo
// (demostración)— y las tres primeras enlazan con la cuarta.
// ---------------------------------------------------------------------------
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { Router, RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/auth.service';
import { mensajeDeError } from '../../core/http-error';
import { Rol, rutaInicioPara } from '../../core/rutas';

/** Una de las tres audiencias, con el paso de "Cómo funciona" que le toca. */
interface Perfil {
  rol: Rol;
  icono: string;
  titulo: string;
  texto: string;
  /** id del paso al que salta la tarjeta. */
  paso: string;
}

/** Un paso del flujo. El número se pinta, no se deduce de la posición. */
interface Paso {
  id: string;
  rol: Rol;
  numero: string;
  titulo: string;
  texto: string;
}

/** Cuenta sembrada por backend/scripts/seedDemo.js. */
interface Demo {
  rol: Rol;
  etiqueta: string;
  nombre: string;
  correo: string;
  password: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-landing',
  imports: [RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly perfiles: Perfil[] = [
    {
      rol: 'estudiante',
      icono: 'school',
      titulo: 'Estudiantes',
      texto: 'Busca en el catálogo, matricúlate y consulta en qué cursos estás.',
      paso: 'paso-estudiante',
    },
    {
      rol: 'profesor',
      icono: 'groups',
      titulo: 'Profesores',
      texto: 'Consulta los cursos que impartes y quién se ha matriculado en ellos.',
      paso: 'paso-profesor',
    },
    {
      rol: 'admin',
      icono: 'admin_panel_settings',
      titulo: 'Administración',
      texto: 'Gestiona usuarios y roles, crea cursos, asigna profesores y matricula alumnos.',
      paso: 'paso-admin',
    },
  ];

  // El orden es el del centro, no el del formulario de registro: primero se
  // monta el curso, luego lo recoge quien lo imparte y al final se matricula
  // quien lo cursa. Así cada tarjeta de perfil tiene un paso al que apuntar.
  readonly pasos: Paso[] = [
    {
      id: 'paso-admin',
      rol: 'admin',
      numero: '01',
      titulo: 'Administración monta el curso',
      texto: 'Crea el curso, le pone descripción y le asigna un profesor.',
    },
    {
      id: 'paso-profesor',
      rol: 'profesor',
      numero: '02',
      titulo: 'El profesor recoge su clase',
      texto:
        'Activa su perfil con la clave del centro y ve los cursos que imparte con su lista de matriculados.',
    },
    {
      id: 'paso-estudiante',
      rol: 'estudiante',
      numero: '03',
      titulo: 'El estudiante se matricula',
      texto: 'Busca en el catálogo, se matricula en un clic y se da de baja igual de fácil.',
    },
  ];

  readonly demos: Demo[] = [
    {
      rol: 'admin',
      etiqueta: 'Administración',
      nombre: 'Admin',
      correo: 'admin@educontrol.com',
      password: 'Admin123*',
    },
    {
      rol: 'profesor',
      etiqueta: 'Profesora',
      nombre: 'Lucía Fernández',
      correo: 'lucia@educontrol.com',
      password: 'Demo1234',
    },
    {
      rol: 'estudiante',
      etiqueta: 'Estudiante',
      nombre: 'Ana Torres',
      correo: 'ana@educontrol.com',
      password: 'Demo1234',
    },
  ];

  /** Correo de la demostración que se está usando: bloquea el doble envío. */
  readonly entrando = signal('');
  readonly error = signal('');

  constructor() {
    // Con sesión iniciada esta página no aporta nada: al panel directamente.
    if (this.auth.estaAutenticado()) {
      const rol = this.auth.usuario()?.rol;
      this.router.navigateByUrl(rutaInicioPara(rol));
    }
  }

  /**
   * Entra con una cuenta de demostración.
   *
   * En /login esto rellena el formulario y lo envía; aquí no hay formulario que
   * rellenar, así que se llama al servicio directamente. El rol de destino sale
   * de la respuesta del servidor, no del `rol` que tenga escrito la tarjeta: si
   * alguna vez dejan de coincidir, manda quien lo sabe.
   */
  entrar(demo: Demo): void {
    if (this.entrando()) return;
    this.entrando.set(demo.correo);
    this.error.set('');

    this.auth.login({ correo: demo.correo, password: demo.password }).subscribe({
      next: () => this.router.navigateByUrl(rutaInicioPara(this.auth.usuario()?.rol)),
      error: err => {
        this.entrando.set('');
        this.error.set(mensajeDeError(err, 'No he podido entrar con esa cuenta de demostración.'));
      },
    });
  }
}
