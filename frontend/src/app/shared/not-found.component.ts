// src/app/shared/not-found.component.ts
// ---------------------------------------------------------------------------
// 404.
//
// Antes la ruta comodín redirigía a /dashboard: escribías mal una URL y
// aparecías en otro sitio sin que nada explicara por qué. Peor aún, sin sesión
// esa redirección acababa en el login, y parecía que te habían echado.
// ---------------------------------------------------------------------------
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../core/auth.service';
import { rutaInicioPara } from '../core/rutas';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-not-found',
  imports: [RouterModule, MatButtonModule, MatIconModule],
  template: `
    <div class="no-encontrado">
      <mat-icon aria-hidden="true">explore_off</mat-icon>
      <h1>Esta página no existe</h1>
      <p>
        La dirección que has abierto no corresponde a ninguna sección. Puede que el enlace esté mal
        escrito o que la página se haya movido.
      </p>

      <!-- El destino depende de si hay sesión: mandar a alguien sin sesión a
           /dashboard solo produce otro rebote hasta el login. -->
      <a mat-flat-button color="primary" [routerLink]="destino">{{ etiquetaDestino }}</a>
    </div>
  `,
  styles: [
    `
      .no-encontrado {
        max-width: 480px;
        margin: 0 auto;
        padding: var(--sp-7) var(--sp-4);
        text-align: center;
      }
      .no-encontrado mat-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: var(--mat-sys-on-surface-variant);
      }
      .no-encontrado h1 {
        font: var(--mat-sys-headline-small);
        margin: var(--sp-4) 0 var(--sp-2);
      }
      .no-encontrado p {
        color: var(--mat-sys-on-surface-variant);
        margin: 0 0 var(--sp-5);
      }
      .no-encontrado a {
        height: 48px;
        display: inline-flex;
        align-items: center;
      }
    `,
  ],
})
export class NotFoundComponent {
  private auth = inject(AuthService);

  get destino(): string {
    if (!this.auth.estaAutenticado()) return '/';
    return rutaInicioPara(this.auth.rol());
  }

  get etiquetaDestino(): string {
    return this.auth.estaAutenticado() ? 'Volver a mi panel' : 'Volver al inicio';
  }
}
