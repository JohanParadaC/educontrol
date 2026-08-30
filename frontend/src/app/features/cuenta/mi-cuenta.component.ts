// src/app/cuenta/mi-cuenta.component.ts
// ---------------------------------------------------------------------------
// "Mi cuenta": datos personales, contraseña y activación de perfil de profesor.
//
// Sustituye a la pantalla "Elegir rol", que estaba en la barra de navegación
// permanentemente. Aquello no era una sección: era una acción puntual —
// convertirte en profesor con la clave del centro— disfrazada de destino, y
// competía con Inicio, Cursos y Mis clases sin aportar un lugar al que volver.
//
// Además recoge el cambio de contraseña, que el backend soportaba desde hace
// tiempo y no tenía ninguna pantalla.
// ---------------------------------------------------------------------------
import { Component, inject, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { mensajeDeError } from '../../core/http-error';
import { idDe } from '../../data/sesion-local';

/** Mismo criterio que `utils/correo.js` en el backend: minúsculas y sin espacios. */
const normalizarCorreo = (correo: string | null | undefined) => (correo ?? '').trim().toLowerCase();

/** La nueva contraseña y su repetición tienen que coincidir. */
function coinciden(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('nueva');
  const repetida = grupo.get('repetida');
  if (!nueva || !repetida) return null;

  if (repetida.value && nueva.value !== repetida.value) {
    repetida.setErrors({ ...(repetida.errors ?? {}), noCoincide: true });
    return { noCoincide: true };
  }
  if (repetida.hasError('noCoincide')) {
    const { noCoincide, ...resto } = repetida.errors ?? {};
    repetida.setErrors(Object.keys(resto).length ? resto : null);
  }
  return null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-mi-cuenta',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './mi-cuenta.component.html',
  styleUrls: ['./mi-cuenta.component.scss'],
})
export class MiCuentaComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private router = inject(Router);
  auth = inject(AuthService);

  readonly ocultar = signal(true);

  readonly guardandoPerfil = signal(false);
  readonly guardandoPassword = signal(false);
  readonly activandoProfesor = signal(false);

  readonly errorPerfil = signal('');
  readonly errorPassword = signal('');
  readonly errorProfesor = signal('');

  perfil: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    correo: ['', [Validators.required, Validators.email]],
    // Sin validador fijo: se vuelve obligatoria solo si el correo cambia.
    contraseñaActual: [''],
  });

  /** El correo tal y como está escrito ahora mismo. */
  private readonly correoEscrito = toSignal(this.perfil.controls['correo'].valueChanges, {
    initialValue: '',
  });

  /**
   * Si el correo escrito es distinto del de la cuenta.
   *
   * El correo es el identificador con el que se entra, así que cambiarlo exige
   * la contraseña actual —el servidor responde 400 si falta—. Pero este mismo
   * formulario manda nombre y correo juntos, y pedir la contraseña para
   * cambiarse el nombre sería cobrar un peaje que nadie debe.
   */
  readonly cambiaElCorreo = computed(() => {
    const escrito = normalizarCorreo(this.correoEscrito());
    return !!escrito && escrito !== normalizarCorreo(this.auth.usuario()?.correo);
  });

  password: FormGroup = this.fb.group(
    {
      actual: ['', [Validators.required]],
      nueva: ['', [Validators.required, Validators.minLength(6)]],
      repetida: ['', [Validators.required]],
    },
    { validators: coinciden }
  );

  profesor: FormGroup = this.fb.group({
    clave: ['', [Validators.required]],
  });

  constructor() {
    const u = this.auth.usuario();
    if (u) this.perfil.patchValue({ nombre: u.nombre, correo: u.correo });

    this.perfil.controls['correo'].valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.exigirContraseñaSiCambiaElCorreo());
  }

  /** El campo solo es obligatorio mientras el correo esté cambiando. */
  private exigirContraseñaSiCambiaElCorreo(): void {
    const control = this.perfil.controls['contraseñaActual'];

    if (this.cambiaElCorreo()) {
      control.addValidators(Validators.required);
    } else {
      control.removeValidators(Validators.required);
      control.setValue('', { emitEvent: false });
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  get usuario() {
    return this.auth.usuario();
  }
  get miId(): string {
    return idDe(this.usuario);
  }
  get soyEstudiante(): boolean {
    return this.usuario?.rol === 'estudiante';
  }

  get etiquetaRol(): string {
    const rol = this.usuario?.rol;
    if (rol === 'admin') return 'Administración';
    if (rol === 'profesor') return 'Profesor';
    return 'Estudiante';
  }

  // ---------------------------------------------------------------- perfil
  guardarPerfil(): void {
    this.errorPerfil.set('');
    if (this.perfil.invalid) {
      this.perfil.markAllAsTouched();
      return;
    }
    if (this.guardandoPerfil()) return;

    // La contraseña solo viaja si hay algo que autorizar con ella. Mandarla
    // siempre la pasearía por la red para cambiarse el nombre.
    const { nombre, correo, contraseñaActual } = this.perfil.getRawValue();
    const cambios = this.cambiaElCorreo()
      ? { nombre, correo, contraseñaActual }
      : { nombre, correo };

    this.guardandoPerfil.set(true);
    this.api.updateUsuario(this.miId, cambios).subscribe({
      next: resp => {
        this.guardandoPerfil.set(false);
        if (resp?.usuario) this.auth.actualizarUsuario(resp.usuario);
        this.perfil.controls['contraseñaActual'].setValue('');
        this.snack.open('Datos actualizados', 'OK', { duration: 2500 });
      },
      error: err => {
        this.guardandoPerfil.set(false);
        this.errorPerfil.set(mensajeDeError(err, 'No se pudieron guardar los datos'));
      },
    });
  }

  // ------------------------------------------------------------ contraseña
  cambiarPassword(): void {
    this.errorPassword.set('');
    if (this.password.invalid) {
      this.password.markAllAsTouched();
      return;
    }
    if (this.guardandoPassword()) return;

    this.guardandoPassword.set(true);
    const { actual, nueva } = this.password.value;

    this.api
      .updateUsuario(this.miId, {
        contraseñaActual: actual,
        contraseña: nueva,
      })
      .subscribe({
        next: () => {
          this.guardandoPassword.set(false);
          this.password.reset();
          this.snack.open('Contraseña actualizada', 'OK', { duration: 2500 });
        },
        error: err => {
          this.guardandoPassword.set(false);
          this.errorPassword.set(mensajeDeError(err, 'No se pudo cambiar la contraseña'));
        },
      });
  }

  // -------------------------------------------------------------- profesor
  activarProfesor(): void {
    this.errorProfesor.set('');
    if (this.profesor.invalid) {
      this.profesor.markAllAsTouched();
      return;
    }
    if (this.activandoProfesor()) return;

    this.activandoProfesor.set(true);
    this.api
      .updateUsuario(this.miId, {
        rol: 'profesor',
        profesorClave: this.profesor.value.clave,
      })
      .subscribe({
        next: resp => {
          this.activandoProfesor.set(false);
          if (resp?.usuario) this.auth.actualizarUsuario(resp.usuario);
          this.profesor.reset();
          this.snack.open('Ya tienes perfil de profesor', 'OK', { duration: 3000 });
          this.router.navigateByUrl('/profesor/dashboard');
        },
        error: err => {
          this.activandoProfesor.set(false);
          this.errorProfesor.set(mensajeDeError(err, 'No se pudo activar el perfil de profesor'));
        },
      });
  }
}
