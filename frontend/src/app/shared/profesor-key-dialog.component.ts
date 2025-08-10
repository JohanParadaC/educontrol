// src/app/shared/profesor-key-dialog.component.ts
// ----------------------------------------------------------------------------
// Diálogo para ingresar la clave de profesor.
// Mejores UX incluidas:
//  - Botón "ojo" para ver/ocultar la clave
//  - Enfoque automático en el input al abrir el diálogo (cdkFocusInitial)
//  - Envío con Enter si el formulario es válido
//  - Se envía la clave "limpia" (trim) para evitar errores por espacios
// ----------------------------------------------------------------------------

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import {
  ReactiveFormsModule,
  Validators,
  FormGroup,
  FormControl
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  selector: 'app-profesor-key-dialog',
  template: `
    <h1 mat-dialog-title>Clave de profesor</h1>

    <!-- ✅ Typed forms: sin error de index signature -->
    <div mat-dialog-content [formGroup]="form">
      <p>Para cambiar al rol <b>profesor</b>, ingresa la clave.</p>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Clave</mat-label>

        <!--
          ⬇️ CAMBIOS:
          - cdkFocusInitial: enfoca el input al abrir el diálogo
          - [type] según "show" para ver/ocultar
          - (keydown.enter) llama a submit() si el form es válido
          - autocomplete/correct/capitalize desactivados para evitar sorpresas
        -->
        <input
          matInput
          cdkFocusInitial
          [type]="show ? 'text' : 'password'"
          formControlName="clave"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          (keydown.enter)="submit()"
        />

        <!-- 👁 ver/ocultar -->
        <button
          mat-icon-button
          matSuffix
          type="button"
          (click)="show = !show"
          [attr.aria-label]="show ? 'Ocultar clave' : 'Mostrar clave'"
          [attr.title]="show ? 'Ocultar' : 'Mostrar'"
        >
          <mat-icon>{{ show ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>

        <mat-error *ngIf="form.controls.clave.hasError('required')">
          La clave es obligatoria
        </mat-error>
        <mat-error *ngIf="form.controls.clave.hasError('minlength')">
          Mínimo 4 caracteres
        </mat-error>
      </mat-form-field>
    </div>

    <!-- ✅ property binding para evitar el aviso en 'align' -->
    <div mat-dialog-actions [align]="'end'">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="form.invalid"
        (click)="submit()"
      >
        Aceptar
      </button>
    </div>
  `,
  styles: [`.w-100{width:100%}`],
  imports: [
    CommonModule, MatDialogModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule
  ]
})
export class ProfesorKeyDialogComponent {
  // ✅ FormGroup TIPADO
  form: FormGroup<{ clave: FormControl<string>; }>;

  // Estado del “ojo” (mostrar/ocultar)
  show = false;

  constructor(public dialogRef: MatDialogRef<ProfesorKeyDialogComponent>) {
    this.form = new FormGroup({
      clave: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(4)]
      })
    });
  }

  submit() {
    // ⬇️ CAMBIO: limpiamos espacios; si queda vacío, no cerramos
    const clave = this.form.controls.clave.value.trim();
    if (!clave) return;
    if (this.form.valid) {
      this.dialogRef.close(clave);
    }
  }
}