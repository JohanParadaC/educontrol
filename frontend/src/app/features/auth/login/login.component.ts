/* ------------------------------------------------------------------------
   LOGIN  – Stand-alone component
   ------------------------------------------------------------------------ */
// src/app/auth/login/login.component.ts

import { Component }              from '@angular/core';
import { CommonModule }           from '@angular/common';
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  UntypedFormGroup
} from '@angular/forms';

import { Router, RouterModule } from '@angular/router';     // 👈 necesario por el routerLink del template
import { AuthService }          from '../../../core/auth.service';
import { mensajeDeError }       from '../../../core/http-error';
import { rutaInicioPara }       from '../../../core/rutas';

/* Angular Material centralizado (si exporta todo) */
/* Solo los módulos que usa la pantalla, no el paquete entero. */
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector:    'app-login',
  standalone:  true,
  templateUrl: './login.component.html',
  styleUrls:  ['./login.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,      // 👈 para usar routerLink en el HTML
    MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatIconModule      // 👈 asegura que <mat-icon> funcione
  ]
})
export class LoginComponent {

  msg = '';                       // mensaje de error para el template
  form: UntypedFormGroup;         // formulario reactivo
  hide = true;                    // 👈 ahora sí existe la propiedad del template
  enviando = false;               // bloquea el doble envío y alimenta el spinner

  /** Cuentas sembradas por backend/scripts/seedDemo.js */
  readonly demos = [
    { etiqueta: 'Administrador', correo: 'admin@educontrol.com',  password: 'Admin123*' },
    { etiqueta: 'Profesora',     correo: 'lucia@educontrol.com',  password: 'Demo1234' },
    { etiqueta: 'Estudiante',    correo: 'ana@educontrol.com',    password: 'Demo1234' }
  ];

  constructor(private fb: FormBuilder,
              private auth: AuthService,
              private router: Router) {

    // construimos el formulario (no strict)
    this.form = this.fb.group({
      correo:   ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  /* ----------------------------------------------------------------------
     Envía credenciales y navega al dashboard según ROL
     -------------------------------------------------------------------- */
  onSubmit(): void {
    this.msg = '';

    // El botón nunca está deshabilitado: es al pulsar cuando se marcan los
    // errores y se lleva el foco al primer campo inválido. Un CTA gris de
    // entrada no previene errores, solo esconde qué falta.
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarPrimerCampoInvalido();
      return;
    }

    if (this.enviando) return;
    this.enviando = true;

    this.auth
      .login(this.form.value as { correo: string; password: string })
      .subscribe({
        next : ()  => {
          // ✅ CAMBIO: redirección por rol (profesor -> /profesor/dashboard)
          const rol = this.getRoleSafe();
          this.router.navigateByUrl(rutaInicioPara(rol));
        },
        error: err => {
          this.enviando = false;
          this.msg = mensajeDeError(err, 'Correo o contraseña incorrectos');
        }
      });
  }

  /** Rellena el formulario con una cuenta de demo y entra. */
  usarDemo(demo: { correo: string; password: string }): void {
    this.form.patchValue({ correo: demo.correo, password: demo.password });
    this.onSubmit();
  }

  /** Lleva el foco al primer control con error, para no obligar a buscarlo. */
  private enfocarPrimerCampoInvalido(): void {
    const primero = Object.keys(this.form.controls)
      .find(nombre => this.form.get(nombre)?.invalid);
    if (!primero) return;

    const campo = document.querySelector<HTMLElement>(`[formControlName="${primero}"]`);
    campo?.focus();
  }

  /** Lee el rol de forma robusta: primero del AuthService, si no desde localStorage */
  private getRoleSafe(): string {
    const r = (this.auth.usuario as any)?.rol;
    if (r) return r;
    try {
      const raw = localStorage.getItem('usuario') || localStorage.getItem('user');
      if (!raw) return '';
      const u = JSON.parse(raw);
      return u?.rol || '';
    } catch { return ''; }
  }
}