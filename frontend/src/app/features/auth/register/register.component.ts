import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  FormGroup,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

/* Angular Material */
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
// CAMBIO: si luego quieres mostrar un select visible
import { MatSelectModule } from '@angular/material/select';

import { ApiService } from '../../../core/api.service';
import { mensajeDeError } from '../../../core/http-error';

/**
 * Validador de grupo: marca el error en el propio control de confirmación para
 * que `mat-error` lo pueda mostrar debajo del campo que falla, y no en un aviso
 * suelto al final del formulario.
 */
function coincidenLasContrasenas(grupo: AbstractControl): ValidationErrors | null {
  const password = grupo.get('password');
  const repetida = grupo.get('password2');
  if (!password || !repetida) return null;

  if (repetida.value && password.value !== repetida.value) {
    repetida.setErrors({ ...(repetida.errors ?? {}), noCoincide: true });
    return { noCoincide: true };
  }

  // Limpiamos solo nuestro error: los demás (required) siguen siendo válidos.
  if (repetida.hasError('noCoincide')) {
    const { noCoincide, ...resto } = repetida.errors ?? {};
    repetida.setErrors(Object.keys(resto).length ? resto : null);
  }
  return null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  imports: [
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSnackBarModule,
    MatSelectModule,
  ],
})
export class RegisterComponent {
  readonly hide = signal(true);
  readonly msg = signal('');
  readonly enviando = signal(false);

  // Declaramos el tipo y lo inicializamos en el constructor
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router,
    private snack: MatSnackBar
  ) {
    // ✅ crear el form aquí evita "Property 'fb' is used before its initialization"
    this.form = this.fb.group(
      {
        nombre: ['', [Validators.required, Validators.minLength(2)]],
        correo: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        // Sin confirmación, una errata al teclear deja la cuenta inaccesible para
        // siempre: no hay recuperación de contraseña.
        password2: ['', [Validators.required]],
        // CAMBIO: rol con valor por defecto (aunque no se muestre)
        rol: ['estudiante', [Validators.required]],
      },
      { validators: coincidenLasContrasenas }
    );
  }

  onSubmit(): void {
    this.msg.set('');

    // Igual que en login: el botón siempre está activo y es el envío el que
    // señala qué falta y lleva el foco al primer campo con error.
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarPrimerCampoInvalido();
      return;
    }

    if (this.enviando()) return;
    this.enviando.set(true);

    // ApiService.register ya traduce password -> 'contraseña'. El formulario
    // no está tipado, así que se declara aquí la forma que tiene: es un molde
    // concreto, no un `as any` que apaga el tipado de la llamada entera.
    const datos = this.form.value as {
      nombre: string;
      correo: string;
      password: string;
      rol: 'estudiante' | 'profesor';
    };
    this.api.register(datos).subscribe({
      next: () => {
        this.snack.open('Cuenta creada. Ahora inicia sesión.', 'OK', { duration: 3000 });
        this.router.navigateByUrl('/login'); // ruta real en tu router
      },
      error: err => {
        this.enviando.set(false);
        this.msg.set(mensajeDeError(err, 'No se pudo crear la cuenta'));
      },
    });
  }

  /** Lleva el foco al primer control con error, para no obligar a buscarlo. */
  private enfocarPrimerCampoInvalido(): void {
    const primero = Object.keys(this.form.controls).find(nombre => this.form.get(nombre)?.invalid);
    if (!primero) return;

    document.querySelector<HTMLElement>(`[formControlName="${primero}"]`)?.focus();
  }
}
