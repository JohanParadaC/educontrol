import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ReactiveFormsModule, Validators, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { TextFieldModule } from '@angular/cdk/text-field';

interface DialogData {
  profesores: Array<{ _id: string; nombre: string; correo: string }>;
  soyAdmin: boolean;
  initial?: { titulo: string; descripcion: string; profesorId?: string };
}

@Component({
  standalone: true,
  selector: 'app-course-create-dialog',
  template: `
    <h1 mat-dialog-title>{{ data.initial ? 'Editar curso' : 'Nuevo curso' }}</h1>

    <div mat-dialog-content [formGroup]="form" class="form-wrap">
      <mat-form-field appearance="outline" floatLabel="always" class="w-100">
        <mat-label>Título</mat-label>
        <input matInput formControlName="titulo" />
        <mat-error *ngIf="form.controls.titulo.invalid">Requerido</mat-error>
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
        <mat-error *ngIf="form.controls.descripcion.invalid">Requerida</mat-error>
      </mat-form-field>

      <ng-container *ngIf="soyAdmin">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Profesor</mat-label>
          <mat-select formControlName="profesorId" (selectionChange)="onProfesorChange($event)">
            <mat-option *ngFor="let p of profesores; trackBy: trackById" [value]="p._id">
              {{ p.nombre }} ({{ p.correo }})
            </mat-option>
          </mat-select>
          <mat-error *ngIf="form.controls.profesorId.invalid">Requerido</mat-error>
        </mat-form-field>
      </ng-container>
    </div>

    <div mat-dialog-actions [align]="'end'">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">
        {{ data.initial ? 'Guardar' : 'Crear' }}
      </button>
    </div>
  `,
  styles: [`
    .w-100{width:100%}
    .form-wrap{display:grid;gap:12px}
  `],
  imports: [
    CommonModule, MatDialogModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatSelectModule, TextFieldModule
  ]
})
export class CourseCreateDialogComponent {
  soyAdmin = false;
  profesores: Array<{ _id: string; nombre: string; correo: string }> = [];

  form!: FormGroup<{
    titulo: FormControl<string>;
    descripcion: FormControl<string>;
    profesorId: FormControl<string>;
  }>;

  constructor(
    public dialogRef: MatDialogRef<CourseCreateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private fb: FormBuilder
  ) {
    this.soyAdmin   = !!data.soyAdmin;
    this.profesores = Array.isArray(data.profesores) ? data.profesores : [];

    this.form = this.fb.nonNullable.group({
      titulo: ['', Validators.required],
      descripcion: ['', Validators.required],
      profesorId: ['']
    });
    if (this.soyAdmin) {
      this.form.controls.profesorId.addValidators(Validators.required);
    }

    if (data.initial) {
      this.form.patchValue({
        titulo: data.initial.titulo ?? '',
        descripcion: data.initial.descripcion ?? '',
        profesorId: data.initial.profesorId ?? ''
      }, { emitEvent: false });
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
    const { titulo, descripcion, profesorId } = this.form.getRawValue();
    const payload = this.soyAdmin
      ? { titulo: titulo.trim(), descripcion: descripcion.trim(), profesor: profesorId }
      : { titulo: titulo.trim(), descripcion: descripcion.trim(), profesor: null };
    this.dialogRef.close(payload);
  }
}