import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

/**
 * Diálogo para matricular (asignar materia) a un estudiante EN el curso
 * desde el que se abre el diálogo.
 *
 * DATA esperada:
 *  - cursoTitulo: string (solo display)
 *  - estudiantes: Array<{ _id: string; nombre: string; correo: string }>
 *    IMPORTANTE: _id debe venir como string.
 */
@Component({
  standalone: true,
  selector: 'app-enroll-student-dialog',
  template: `
    <h2 mat-dialog-title>Asignar materia en "{{ data.cursoTitulo }}"</h2>

    <div mat-dialog-content [formGroup]="form" class="grid gap-3">
      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Estudiante</mat-label>
        <mat-select formControlName="estudianteId" placeholder="Selecciona un estudiante">
          <mat-option *ngFor="let e of data.estudiantes; trackBy: trackById" [value]="e._id">
            {{ e.nombre }} ({{ e.correo }})
          </mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">
        Asignar
      </button>
    </div>
  `,
  styles: [`.w-100{width:100%}`],
  imports: [
    CommonModule, MatDialogModule, ReactiveFormsModule,
    MatFormFieldModule, MatSelectModule, MatButtonModule
  ]
})
export class EnrollStudentDialogComponent {
  // Form REACTIVO tipado: requiere estudianteId (string)
  form!: FormGroup<{ estudianteId: FormControl<string> }>;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { cursoTitulo: string; estudiantes: Array<{ _id: string; nombre: string; correo: string }> },
    public dialogRef: MatDialogRef<EnrollStudentDialogComponent>,
    private fb: FormBuilder
  ) {
    // Crear el form en el constructor (evita el warning “fb used before initialization”)
    this.form = this.fb.nonNullable.group({
      estudianteId: ['', Validators.required]
    });
  }

  trackById = (_: number, it: { _id: string }) => it._id;

  submit() {
    if (this.form.invalid) return;
    // devolvemos SOLO el id del estudiante seleccionado
    this.dialogRef.close(this.form.getRawValue().estudianteId);
  }
}