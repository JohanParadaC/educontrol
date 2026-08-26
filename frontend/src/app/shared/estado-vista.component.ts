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
//   @if (cargando || error || !hayDatos) {
//     <app-estado-vista [cargando]="cargando" [error]="error"
//                       mensajeVacio="Todavía no hay cursos"
//                       (reintentar)="cargar()"></app-estado-vista>
//   }
// ---------------------------------------------------------------------------
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-estado-vista',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <!-- 1) Cargando -->
    @if (cargando) {
      <div class="estado" aria-busy="true" [attr.aria-label]="textoCargando">
        @for (_ of filas; track _) {
          <div class="esqueleto">
            <div class="linea titulo"></div>
            <div class="linea corta"></div>
          </div>
        }
      </div>
    }

    <!-- 2) Error: mensaje real y una salida -->
    @if (!cargando && error) {
      <div class="estado centrado error" role="alert">
        <mat-icon aria-hidden="true">error_outline</mat-icon>
        <p>{{ error }}</p>
        <button mat-stroked-button type="button" (click)="reintentar.emit()">Reintentar</button>
      </div>
    }

    <!-- 3) Vacío: distinto de un fallo -->
    @if (!cargando && !error) {
      <div class="estado centrado">
        <!-- Ilustración monocroma en línea, dibujada con los tokens: el icono
             gris de Material que había antes decía "aquí falta algo" con el
             mismo tono con el que un error dice "aquí se ha roto algo". -->
        <svg class="ilustracion" viewBox="0 0 120 90" role="img" [attr.aria-label]="mensajeVacio">
          @switch (ilustracion) {
            @case ('cursos') {
              <!-- Tres libros: uno abierto y dos apilados detrás. -->
              <rect class="trazo tenue" x="18" y="20" width="34" height="46" rx="4" />
              <rect class="trazo tenue" x="30" y="14" width="34" height="52" rx="4" />
              <path class="trazo relleno" d="M46 26h30a6 6 0 0 1 6 6v34H52a6 6 0 0 1-6-6z" />
              <path class="trazo" d="M60 34h14M60 44h14M60 54h9" />
            }
            @case ('gente') {
              <!-- Dos siluetas: una delante y otra detrás. -->
              <circle class="trazo tenue" cx="44" cy="32" r="11" />
              <path class="trazo tenue" d="M26 68a18 18 0 0 1 36 0z" />
              <circle class="trazo relleno" cx="72" cy="36" r="13" />
              <path class="trazo relleno" d="M52 72a20 20 0 0 1 40 0z" />
            }
            @case ('busqueda') {
              <!-- Lupa vacía. -->
              <circle class="trazo relleno" cx="54" cy="40" r="20" />
              <path class="trazo" d="M69 55l16 16" />
              <path class="trazo tenue" d="M44 40h20" />
            }
            @default {
              <!-- Bandeja vacía. -->
              <path class="trazo relleno" d="M24 34h72l-10 32H34z" />
              <path class="trazo" d="M24 34l6-14h60l6 14" />
              <path class="trazo tenue" d="M46 48h28" />
            }
          }
        </svg>

        <p>{{ mensajeVacio }}</p>
      </div>
    }
  `,
  styles: [
    `
      .estado {
        display: grid;
        gap: 12px;
        padding: 24px 16px;
      }
      .centrado {
        justify-items: center;
        text-align: center;
        padding: 48px 16px;
        color: var(--mat-sys-on-surface-variant);
      }
      .centrado mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        opacity: 0.6;
      }
      .centrado p {
        margin: 0;
      }
      .error {
        color: var(--mat-sys-on-error-container);
      }

      .esqueleto {
        display: grid;
        gap: 8px;
      }
      .linea {
        height: 12px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent);
        animation: latido 1.4s ease-in-out infinite;
      }
      .titulo {
        height: 18px;
        width: 55%;
      }
      .corta {
        width: 30%;
      }
      /* La ilustración se dibuja con los tokens: en oscuro cambia sola y no
         hay una versión clara y otra oscura que mantener. */
      .ilustracion {
        width: 120px;
        height: 90px;
        margin-bottom: var(--sp-1);
      }

      .trazo {
        fill: none;
        stroke: var(--texto-suave);
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .relleno {
        fill: var(--acento-suave);
        stroke: var(--acento);
      }

      .tenue {
        opacity: 0.45;
      }

      @keyframes latido {
        0%,
        100% {
          opacity: 0.45;
        }
        50% {
          opacity: 0.9;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .linea {
          animation: none;
        }
      }
    `,
  ],
})
export class EstadoVistaComponent {
  @Input() cargando = false;
  /** Texto del error, o cadena vacía si no lo hubo. */
  @Input() error = '';
  @Input() mensajeVacio = 'No hay nada que mostrar.';

  /** Qué se dibuja cuando no hay datos. */
  @Input() ilustracion: 'bandeja' | 'cursos' | 'gente' | 'busqueda' = 'bandeja';
  @Input() textoCargando = 'Cargando…';
  /** Cuántas filas de esqueleto pintar mientras carga. */
  @Input() filas = [1, 2, 3];

  @Output() reintentar = new EventEmitter<void>();
}
