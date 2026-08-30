import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  ReactiveFormsModule,
  Validators,
  FormBuilder,
  FormGroup,
  FormControl,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { TextFieldModule } from '@angular/cdk/text-field';

import { EstadoCurso } from '../../data/curso.model';

/** Las tres opciones de estado, con el texto que se lee en pantalla. */
const ESTADOS: Array<{ valor: EstadoCurso; etiqueta: string; ayuda: string }> = [
  { valor: 'abierto', etiqueta: 'Abierto', ayuda: 'Admite matrículas' },
  { valor: 'cerrado', etiqueta: 'Cerrado', ayuda: 'Sigue visible, ya no admite' },
  { valor: 'archivado', etiqueta: 'Archivado', ayuda: 'Fuera del catálogo del estudiante' },
];

interface DialogData {
  profesores: Array<{ _id: string; nombre: string; correo: string }>;
  soyAdmin: boolean;
  initial?: {
    titulo: string;
    descripcion: string;
    profesorId?: string;
    cupoMaximo?: number | null;
    estado?: EstadoCurso;
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-course-create-dialog',
  template: `
    <h1 mat-dialog-title>{{ data.initial ? 'Editar curso' : 'Nuevo curso' }}</h1>

    <div mat-dialog-content [formGroup]="form" class="form-wrap">
      <mat-form-field appearance="outline" floatLabel="always" class="w-100">
        <mat-label>Título</mat-label>
        <input matInput formControlName="titulo" />
        @if (form.controls.titulo.invalid) {
          <mat-error>Requerido</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Descripción</mat-label>
        <textarea
          matInput
          formControlName="descripcion"
          cdkTextareaAutosize
          cdkAutosizeMinRows="3"
          cdkAutosizeMaxRows="12"
        ></textarea>
        @if (form.controls.descripcion.invalid) {
          <mat-error>Requerida</mat-error>
        }
      </mat-form-field>

      <div class="dos">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Plazas</mat-label>
          <input matInput type="number" min="1" step="1" formControlName="cupoMaximo" />
          <!-- Vacío no es cero: es "sin límite". Se dice, porque un campo
               numérico en blanco se lee de las dos maneras. -->
          <mat-hint>Déjalo vacío para no poner límite</mat-hint>
          @if (form.controls.cupoMaximo.hasError('min')) {
            <mat-error>Al menos una plaza</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Estado</mat-label>
          <mat-select formControlName="estado">
            @for (e of estados; track e.valor) {
              <mat-option [value]="e.valor">{{ e.etiqueta }} — {{ e.ayuda }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (soyAdmin) {
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Profesor</mat-label>
          <mat-select formControlName="profesorId" (selectionChange)="onProfesorChange($event)">
            @for (p of profesores; track trackById($index, p)) {
              <mat-option [value]="p._id"> {{ p.nombre }} ({{ p.correo }}) </mat-option>
            }
          </mat-select>
          @if (form.controls.profesorId.invalid) {
            <mat-error>Requerido</mat-error>
          }
        </mat-form-field>
      }
    </div>

    <div mat-dialog-actions [align]="'end'">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">
        {{ data.initial ? 'Guardar' : 'Crear' }}
      </button>
    </div>
  `,
  styles: [
    `
      .w-100 {
        width: 100%;
      }
      .form-wrap {
        display: grid;
        gap: 12px;
      }
      /* Plazas y estado caben en una fila; en móvil se apilan solas. */
      .dos {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }
    `,
  ],
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    TextFieldModule,
  ],
})
export class CourseCreateDialogComponent {
  soyAdmin = false;
  profesores: Array<{ _id: string; nombre: string; correo: string }> = [];
  readonly estados = ESTADOS;

  form!: FormGroup<{
    titulo: FormControl<string>;
    descripcion: FormControl<string>;
    profesorId: FormControl<string>;
    cupoMaximo: FormControl<number | null>;
    estado: FormControl<EstadoCurso>;
  }>;

  readonly dialogRef = inject<MatDialogRef<CourseCreateDialogComponent>>(MatDialogRef);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);

  constructor() {
    const data = this.data;
    this.soyAdmin = !!data.soyAdmin;
    this.profesores = Array.isArray(data.profesores) ? data.profesores : [];

    this.form = this.fb.nonNullable.group({
      titulo: ['', Validators.required],
      descripcion: ['', Validators.required],
      profesorId: [''],
      // `null` y no 0: el campo vacío significa "sin límite".
      cupoMaximo: this.fb.control<number | null>(null, Validators.min(1)),
      estado: this.fb.nonNullable.control<EstadoCurso>('abierto'),
    });
    if (this.soyAdmin) {
      this.form.controls.profesorId.addValidators(Validators.required);
    }

    if (data.initial) {
      this.form.patchValue(
        {
          titulo: data.initial.titulo ?? '',
          descripcion: data.initial.descripcion ?? '',
          profesorId: data.initial.profesorId ?? '',
          cupoMaximo: data.initial.cupoMaximo ?? null,
          estado: data.initial.estado ?? 'abierto',
        },
        { emitEvent: false }
      );
    }
  }

  trackById = (_: number, item: { _id: string }) => item._id;

  onProfesorChange(ev: MatSelectChange) {
    const val = String(ev.value ?? '');
    this.form.controls.profesorId.setValue(val);
    this.form.controls.profesorId.markAsTouched();
    this.form.controls.profesorId.updateValueAndValidity();
  }

  submit() {
    if (this.form.invalid) return;
    const { titulo, descripcion, profesorId, cupoMaximo, estado } = this.form.getRawValue();

    // Un input numérico vacío da cadena vacía, no null: se normaliza aquí para
    // que el backend reciba siempre `null` cuando se quiere quitar el límite.
    const cupo =
      cupoMaximo === null || (cupoMaximo as unknown as string) === '' ? null : Number(cupoMaximo);

    this.dialogRef.close({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      profesor: this.soyAdmin ? profesorId : null,
      cupoMaximo: cupo,
      estado,
    });
  }
}
