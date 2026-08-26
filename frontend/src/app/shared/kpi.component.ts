// src/app/shared/kpi.component.ts
// ---------------------------------------------------------------------------
// Una cifra con contexto.
//
// Antes los KPI del panel de profesor eran texto suelto: "2" encima de "Cursos
// activos", sin tarjeta, sin icono y sin fondo visible (el que tenían era
// blanco al 4 %, invisible sobre fondo claro). No parecían métricas, parecían
// una errata.
//
// La variación es opcional a propósito: solo se pinta cuando hay un dato real
// que la sostenga. Un "+0 %" inventado es peor que no decir nada.
// ---------------------------------------------------------------------------
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-kpi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <article class="kpi">
      <span class="kpi__icono" [class]="'kpi__icono--' + tono" aria-hidden="true">
        <mat-icon>{{ icono }}</mat-icon>
      </span>

      <span class="kpi__cifras">
        <span class="kpi__numero">{{ valor }}</span>
        <span class="kpi__etiqueta">{{ etiqueta }}</span>
        @if (variacion) {
          <span class="kpi__variacion">{{ variacion }}</span>
        }
      </span>
    </article>
  `,
  styles: [
    `
      .kpi {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        padding: var(--sp-4);
        background: var(--superficie-0);
        border: 1px solid var(--borde);
        border-radius: var(--radio-lg);
        box-shadow: var(--sombra-1);
      }

      .kpi__icono {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        flex: none;
        border-radius: var(--radio-md);
        background: var(--acento-suave);
        color: var(--acento-fuerte);
      }

      .kpi__icono--estudiante {
        background: color-mix(in srgb, var(--rol-estudiante) 14%, transparent);
        color: var(--rol-estudiante-texto);
      }

      .kpi__icono--profesor {
        background: color-mix(in srgb, var(--rol-profesor) 14%, transparent);
        color: var(--rol-profesor-texto);
      }

      .kpi__cifras {
        display: grid;
        min-width: 0;
      }

      .kpi__numero {
        font: var(--mat-sys-display-small);
        color: var(--texto);
        line-height: 1.1;

        /* Cifras tabulares: sin esto, "11" y "28" ocupan anchos distintos y la
           fila de KPI baila cada vez que cambia un número. */
        font-variant-numeric: tabular-nums;
      }

      .kpi__etiqueta {
        font: var(--mat-sys-body-small);
        color: var(--texto-suave);
      }

      .kpi__variacion {
        margin-top: 2px;
        font: var(--mat-sys-label-small);
        color: var(--exito);
      }
    `,
  ],
})
export class KpiComponent {
  @Input({ required: true }) valor!: number | string;
  @Input({ required: true }) etiqueta!: string;
  @Input({ required: true }) icono!: string;

  /** Texto de contexto, del tipo "+2 esta semana". Vacío = no se pinta. */
  @Input() variacion = '';

  /** Color del contenedor del icono. Por defecto, el acento. */
  @Input() tono: 'acento' | 'estudiante' | 'profesor' = 'acento';
}
