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
import { AuthService }          from '../../core/auth.service';

/* Angular Material centralizado (si exporta todo) */
import { MaterialModule } from '../../shared/material.module';

/* Si tu MaterialModule NO exporta MatIcon, impórtalo directo aquí */
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector:    'app-login',
  standalone:  true,
  templateUrl: './login.component.html',
  styleUrls:  ['./login.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,      // 👈 para usar routerLink en el HTML
    MaterialModule,
    MatIconModule      // 👈 asegura que <mat-icon> funcione
  ]
})
export class LoginComponent {

  msg = '';                       // mensaje de error para el template
  form: UntypedFormGroup;         // formulario reactivo
  hide = true;                    // 👈 ahora sí existe la propiedad del template

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
    if (this.form.invalid) { return; }

    this.auth
      .login(this.form.value as { correo: string; password: string })
      .subscribe({
        next : ()  => {
          // ✅ CAMBIO: redirección por rol (profesor -> /profesor/dashboard)
          const rol = this.getRoleSafe();
          this.router.navigateByUrl(rol === 'profesor' ? '/profesor/dashboard' : '/dashboard');
        },
        error: err => {
          this.msg = err?.error?.msg || 'Credenciales inválidas';
        }
      });
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