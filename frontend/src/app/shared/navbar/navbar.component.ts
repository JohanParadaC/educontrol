import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';

import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

// Solo lo que la barra usa de verdad.
// Antes importaba MaterialModule, que reexporta doce módulos (Sidenav,
// Expansion, List, Table…). Como la barra vive en el bundle inicial, arrastraba
// todo eso a la primera carga aunque no se usara nada.
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/auth.service';
import { rutaInicioPara } from '../../core/rutas';

/** Un enlace de la barra, con la condición para mostrarlo. */
interface Enlace {
  etiqueta: string;
  ruta: string;
  icono: string;
  visible: () => boolean;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  imports: [RouterModule, MatToolbarModule, MatButtonModule, MatIconModule],
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  /** Menú desplegable en móvil. En escritorio no se usa. */
  readonly menuAbierto = signal(false);

  /** Rol y sesión salen tal cual de AuthService, que ya son señales. */
  readonly role = this.auth.rol;
  readonly isLoggedIn = this.auth.estaAutenticado;

  /**
   * Los enlaces viven aquí y no repetidos en la plantilla: antes había que
   * escribir cada botón dos veces (escritorio y móvil) y era cuestión de tiempo
   * que las dos versiones dejaran de coincidir.
   */
  readonly enlaces: Enlace[] = [
    {
      etiqueta: 'Inicio',
      ruta: '/dashboard',
      icono: 'dashboard',
      visible: () => this.isLoggedIn() && this.role() !== 'profesor',
    },
    {
      etiqueta: 'Inicio',
      ruta: '/profesor/dashboard',
      icono: 'dashboard',
      visible: () => this.isLoggedIn() && this.role() === 'profesor',
    },
    {
      etiqueta: 'Cursos',
      ruta: '/cursos',
      icono: 'school',
      visible: () => this.isLoggedIn() && this.role() === 'estudiante',
    },
    {
      // Estaba enrutada y sin enlazar: solo se llegaba escribiendo la URL.
      etiqueta: 'Mis cursos',
      ruta: '/mis-cursos',
      icono: 'bookmark',
      visible: () => this.isLoggedIn() && this.role() === 'estudiante',
    },
    {
      etiqueta: 'Mis clases',
      ruta: '/profesor/clases',
      icono: 'groups',
      visible: () => this.isLoggedIn() && this.role() === 'profesor',
    },
    {
      etiqueta: 'Administración',
      ruta: '/admin',
      icono: 'admin_panel_settings',
      visible: () => this.isLoggedIn() && this.role() === 'admin',
    },
    // "Elegir rol" ya no está: era una acción puntual —activar el perfil de
    // profesor con una clave— ocupando un sitio fijo en la navegación y
    // compitiendo con los destinos reales. Ahora vive dentro de Mi cuenta.
    {
      etiqueta: 'Mi cuenta',
      ruta: '/cuenta',
      icono: 'account_circle',
      visible: () => this.isLoggedIn(),
    },
    { etiqueta: 'Entrar', ruta: '/login', icono: 'login', visible: () => !this.isLoggedIn() },
    {
      etiqueta: 'Crear cuenta',
      ruta: '/register',
      icono: 'person_add',
      visible: () => !this.isLoggedIn(),
    },
  ];

  /**
   * Los enlaces que tocan a este rol.
   *
   * Es `computed` y no un getter: con OnPush, un getter se reevaluaría solo
   * cuando algo más marcase la vista, y al iniciar sesión la barra se quedaría
   * con los enlaces de invitado hasta el siguiente clic.
   */
  readonly enlacesVisibles = computed(() => {
    // Leer la sesión aquí deja escrita la dependencia, aunque `visible()`
    // también la registre por su cuenta.
    this.auth.usuario();
    return this.enlaces.filter(e => e.visible());
  });

  /** Ruta de la marca: sin sesión, la portada; con sesión, tu panel. */
  readonly rutaInicio = computed(() => (this.isLoggedIn() ? rutaInicioPara(this.role()) : '/'));

  constructor() {
    // Navegar cierra el menú: si no, al elegir una opción el panel se queda
    // abierto tapando la página a la que acabas de llegar.
    this.router.events
      .pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.menuAbierto.set(false));
  }

  alternarMenu(): void {
    this.menuAbierto.update(abierto => !abierto);
  }

  /** Escape cierra el menú, como se espera de cualquier panel desplegable. */
  @HostListener('document:keydown.escape')
  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  /** Cierra sesión y navega al login */
  logout(): void {
    this.menuAbierto.set(false);
    try {
      this.auth.logout(); // Limpia token/estado
    } finally {
      this.router.navigateByUrl('/login');
    }
  }
}
