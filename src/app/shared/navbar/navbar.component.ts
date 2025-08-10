import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

// Puedes seguir usando tu módulo que reexporta Material
import { MaterialModule } from '../material.module';
import { AuthService } from '../../core/auth.service';

@Component({
  selector   : 'app-navbar',
  standalone : true,
  templateUrl: './navbar.component.html',
  styleUrls  : ['./navbar.component.scss'],
  imports    : [
    CommonModule,          // ⭐️ incluye *ngIf, *ngFor, etc.
    RouterModule,
    MaterialModule
  ]
})
export class NavbarComponent {
  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  /** ✅ Getter simple para no ensuciar el template */
  get role(): 'estudiante' | 'profesor' | 'admin' | '' {
    // Si no hay usuario o no tiene rol, devolvemos ''
    return (this.auth.usuario?.rol as any) || '';
  }

  /** ✅ Estado de sesión (AuthService ya expone la propiedad) */
  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn;
  }

  /** Cierra sesión y navega al login */
  logout(): void {
    try {
      this.auth.logout();           // Limpia token/estado
    } finally {
      // FIX: tu ruta real de login es '/login' (no '/auth/login')
      this.router.navigateByUrl('/login');
    }
  }
}