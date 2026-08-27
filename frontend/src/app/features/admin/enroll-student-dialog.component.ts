import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup,
  FormControl,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

/** Lo que devuelve el diálogo: una de las dos vías, nunca las dos. */
export interface MatriculaPedida {
  estudianteId?: string;
  correo?: string;
}

interface DatosMatricula {
  cursoTitulo: string;
  /**
   * Los estudiantes entre los que elegir. Solo los tiene el administrador:
   * `GET /api/usuarios` es suyo. Si no llegan, el diálogo pide el correo.
   */
  estudiantes?: Array<{ _id: string; nombre: string; correo: string }>;
}

/**
 * Matricular a alguien en un curso, desde el panel o desde la ficha del curso.
 *
 * Tiene dos modos porque los dos roles que matriculan saben cosas distintas:
 *
 *   admin    → tiene la lista de estudiantes y elige de un desplegable.
 *   profesor → no la tiene, y no debería: darle `GET /api/usuarios` sería
 *              entregarle el nombre y el correo de todos los estudiantes del
 *              centro. Escribe el correo de quien ya conoce y lo resuelve el
 *              servidor.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-enroll-student-dialog',
  template: `
    <h2 mat-dialog-title>Matricular en «{{ data.cursoTitulo }}»</h2>

    <div mat-dialog-content [formGroup]="form" class="grid gap-3">
      @if (porLista) {
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Estudiante</mat-label>
          <mat-select formControlName="estudianteId" placeholder="Selecciona un estudiante">
            @for (e of data.estudiantes; track e._id) {
              <mat-option [value]="e._id"> {{ e.nombre }} ({{ e.correo }}) </mat-option>
            }
          </mat-select>
        </mat-form-field>
      } @else {
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Correo del estudiante</mat-label>
          <input matInput type="email" formControlName="correo" autocomplete="off" />
          <mat-hint>Tiene que tener ya una cuenta en EduControl.</mat-hint>
          @if (form.controls.correo.touched && form.controls.correo.invalid) {
            <mat-error>Escribe un correo válido</mat-error>
          }
        </mat-form-field>
      }
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">
        Matricular
      </button>
    </div>
  `,
  styles: [
    `
      .w-100 {
        width: 100%;
      }
    `,
  ],
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
})
export class EnrollStudentDialogComponent {
  /** Con lista, desplegable; sin ella, correo. */
  readonly porLista: boolean;

  form!: FormGroup<{ estudianteId: FormControl<string>; correo: FormControl<string> }>;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DatosMatricula,
    public dialogRef: MatDialogRef<EnrollStudentDialogComponent, MatriculaPedida | undefined>,
    private fb: FormBuilder
  ) {
    this.porLista = Array.isArray(data.estudiantes);

    this.form = this.fb.nonNullable.group({
      estudianteId: [''],
      correo: [''],
    });

    // Solo se valida el campo que se ve: con los dos obligatorios, el modo
    // correo nunca habilitaría el botón.
    if (this.porLista) {
      this.form.controls.estudianteId.addValidators(Validators.required);
    } else {
      this.form.controls.correo.addValidators([Validators.required, Validators.email]);
    }
  }

  submit() {
    if (this.form.invalid) return;
    const { estudianteId, correo } = this.form.getRawValue();
    this.dialogRef.close(this.porLista ? { estudianteId } : { correo: correo.trim() });
  }
}
