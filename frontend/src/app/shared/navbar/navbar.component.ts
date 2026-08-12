import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

// Solo lo que la barra usa de verdad.
// Antes importaba MaterialModule, que reexporta doce módulos (Sidenav,
// Expansion, List, Table…). Como la barra vive en el bundle inicial, arrastraba
// todo eso a la primera carga aunque no se usara nada.
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/auth.service';

/** Un enlace de la barra, con la condición para mostrarlo. */
interface Enlace {
  etiqueta: string;
  ruta: string;
  icono: string;
  visible: () => boolean;
}

@Component({
  selector   : 'app-navbar',
  standalone : true,
  templateUrl: './navbar.component.html',
  styleUrls  : ['./navbar.component.scss'],
  imports    : [
    CommonModule,          // ⭐️ incluye *ngIf, *ngFor, etc.
    RouterModule,
    MatToolbarModule, MatButtonModule, MatIconModule
  ]
})
export class NavbarComponent {
  /** Menú desplegable en móvil. En escritorio no se usa. */
  menuAbierto = false;

  /**
   * Los enlaces viven aquí y no repetidos en la plantilla: antes había que
   * escribir cada botón dos veces (escritorio y móvil) y era cuestión de tiempo
   * que las dos versiones dejaran de coincidir.
   */
  readonly enlaces: Enlace[] = [
    {
      etiqueta: 'Inicio', ruta: '/dashboard', icono: 'dashboard',
      visible: () => this.isLoggedIn && this.role !== 'profesor'
    },
    {
      etiqueta: 'Inicio', ruta: '/profesor/dashboard', icono: 'dashboard',
      visible: () => this.isLoggedIn && this.role === 'profesor'
    },
    {
      etiqueta: 'Cursos', ruta: '/cursos', icono: 'school',
      visible: () => this.isLoggedIn && this.role === 'estudiante'
    },
    {
      etiqueta: 'Mis clases', ruta: '/profesor/clases', icono: 'groups',
      visible: () => this.isLoggedIn && this.role === 'profesor'
    },
    {
      etiqueta: 'Administración', ruta: '/admin', icono: 'admin_panel_settings',
      visible: () => this.isLoggedIn && this.role === 'admin'
    },
    // "Elegir rol" ya no está: era una acción puntual —activar el perfil de
    // profesor con una clave— ocupando un sitio fijo en la navegación y
    // compitiendo con los destinos reales. Ahora vive dentro de Mi cuenta.
    {
      etiqueta: 'Mi cuenta', ruta: '/cuenta', icono: 'account_circle',
      visible: () => this.isLoggedIn
    },
    { etiqueta: 'Entrar',       ruta: '/login',    icono: 'login',        visible: () => !this.isLoggedIn },
    { etiqueta: 'Crear cuenta', ruta: '/register', icono: 'person_add',   visible: () => !this.isLoggedIn }
  ];

  constructor(
    public auth: AuthService,
    private router: Router
  ) {
    // Navegar cierra el menú: si no, al elegir una opción el panel se queda
    // abierto tapando la página a la que acabas de llegar.
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.menuAbierto = false);
  }

  get enlacesVisibles(): Enlace[] {
    return this.enlaces.filter(e => e.visible());
  }

  /** ✅ Getter simple para no ensuciar el template */
  get role(): 'estudiante' | 'profesor' | 'admin' | '' {
    // Si no hay usuario o no tiene rol, devolvemos ''
    return (this.auth.usuario?.rol as any) || '';
  }

  /** ✅ Estado de sesión (AuthService ya expone la propiedad) */
  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn;
  }

  /** Ruta de la marca: sin sesión, la portada; con sesión, tu panel. */
  get rutaInicio(): string {
    if (!this.isLoggedIn) return '/';
    return this.role === 'profesor' ? '/profesor/dashboard' : '/dashboard';
  }

  alternarMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  /** Escape cierra el menú, como se espera de cualquier panel desplegable. */
  @HostListener('document:keydown.escape')
  cerrarMenu(): void {
    this.menuAbierto = false;
  }

  /** Cierra sesión y navega al login */
  logout(): void {
    this.menuAbierto = false;
    try {
      this.auth.logout();           // Limpia token/estado
    } finally {
      // FIX: tu ruta real de login es '/login' (no '/auth/login')
      this.router.navigateByUrl('/login');
    }
  }
}
