// src/app/shared/confirm-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

type ConfirmData = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** 'primary' | 'accent' | 'warn' */
  confirmColor?: 'primary' | 'accent' | 'warn';
};

@Component({
  standalone: true,
  selector: 'app-confirm-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="title">
      <mat-icon>warning_amber</mat-icon>
      {{ data.title || '¿Estás seguro?' }}
    </h2>

    <div mat-dialog-content class="content">
      {{ data.message || 'Confirma la acción.' }}
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="close(false)">
        {{ data.cancelText || 'Cancelar' }}
      </button>
      <button mat-flat-button [color]="data.confirmColor || 'warn'" (click)="close(true)">
        {{ data.confirmText || 'Confirmar' }}
      </button>
    </div>
  `,
  styles: [`
    .title{display:flex;align-items:center;gap:8px;margin:0}
    .content{margin-top:4px}
  `]
})
export class ConfirmDialogComponent {
  constructor(
    private ref: MatDialogRef<ConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmData
  ) {}
  close(v: boolean){ this.ref.close(v); }
}