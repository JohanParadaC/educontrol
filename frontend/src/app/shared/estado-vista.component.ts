// src/app/shared/estado-vista.component.ts
// ---------------------------------------------------------------------------
// Los tres estados de una vista que carga datos: cargando, error y vacío.
//
// Existe porque el patrón se repetía mal en varias pantallas: los errores se
// tragaban con `catchError(() => of([]))` y acababan pintando el estado vacío.
// Es la peor confusión posible — "no tienes cursos" y "no he podido
// preguntarlo" llevan al usuario a acciones distintas.
//
// Uso:
//   <app-estado-vista *ngIf="cargando || error || !hayDatos"
//                     [cargando]="cargando" [error]="error"
//                     mensajeVacio="Todavía no hay cursos"
//                     (reintentar)="cargar()"></app-estado-vista>
// ---------------------------------------------------------------------------
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  selector: 'app-estado-vista',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <!-- 1) Cargando -->
    <div *ngIf="cargando" class="estado" aria-busy="true" [attr.aria-label]="textoCargando">
      <div class="esqueleto" *ngFor="let _ of filas">
        <div class="linea titulo"></div>
        <div class="linea corta"></div>
      </div>
    </div>

    <!-- 2) Error: mensaje real y una salida -->
    <div *ngIf="!cargando && error" class="estado centrado error" role="alert">
      <mat-icon aria-hidden="true">error_outline</mat-icon>
      <p>{{ error }}</p>
      <button mat-stroked-button type="button" (click)="reintentar.emit()">Reintentar</button>
    </div>

    <!-- 3) Vacío: distinto de un fallo -->
    <div *ngIf="!cargando && !error" class="estado centrado">
      <mat-icon aria-hidden="true">{{ iconoVacio }}</mat-icon>
      <p>{{ mensajeVacio }}</p>
    </div>
  `,
  styles: [`
    .estado { display: grid; gap: 12px; padding: 24px 16px; }
    .centrado {
      justify-items: center;
      text-align: center;
      padding: 48px 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    .centrado mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: .6; }
    .centrado p { margin: 0; }
    .error { color: var(--mat-sys-on-error-container); }

    .esqueleto { display: grid; gap: 8px; }
    .linea {
      height: 12px; border-radius: 6px;
      background: color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent);
      animation: latido 1.4s ease-in-out infinite;
    }
    .titulo { height: 18px; width: 55%; }
    .corta  { width: 30%; }
    @keyframes latido { 0%,100% { opacity: .45 } 50% { opacity: .9 } }
    @media (prefers-reduced-motion: reduce) { .linea { animation: none } }
  `]
})
export class EstadoVistaComponent {
  @Input() cargando = false;
  /** Texto del error, o cadena vacía si no lo hubo. */
  @Input() error = '';
  @Input() mensajeVacio = 'No hay nada que mostrar.';
  @Input() iconoVacio = 'inbox';
  @Input() textoCargando = 'Cargando…';
  /** Cuántas filas de esqueleto pintar mientras carga. */
  @Input() filas = [1, 2, 3];

  @Output() reintentar = new EventEmitter<void>();
}
