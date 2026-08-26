import { NgModule } from '@angular/core';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';

// ✅ NUEVOS imports necesarios para los componentes que te fallaban
import { MatProgressBarModule } from '@angular/material/progress-bar'; // para <mat-progress-bar>
import { MatExpansionModule } from '@angular/material/expansion'; // para <mat-accordion>/<mat-expansion-panel>
import { MatListModule } from '@angular/material/list'; // para <mat-list>/<mat-list-item>

@NgModule({
  // (Opcional) También puedes listarlos en imports; ayuda si este módulo llegara a declarar algo.
  imports: [
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatSnackBarModule,
    MatTableModule,

    // 👇 añadidos
    MatProgressBarModule,
    MatExpansionModule,
    MatListModule,
  ],
  // Lo importante es re-exportarlos para que estén disponibles donde importas MaterialModule.
  exports: [
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatSnackBarModule,
    MatTableModule,

    // 👇 añadidos
    MatProgressBarModule,
    MatExpansionModule,
    MatListModule,
  ],
})
export class MaterialModule {}
