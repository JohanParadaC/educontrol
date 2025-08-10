// src/app/role-select/role-select.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MaterialModule } from '../shared/material.module';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';

import { MatDialog } from '@angular/material/dialog';
import { ProfesorKeyDialogComponent } from '../shared/profesor-key-dialog.component';

type Rol = 'estudiante' | 'profesor';

@Component({
  standalone: true,
  selector: 'app-role-select',
  templateUrl: './role-select.component.html',
  styleUrls: ['./role-select.component.scss'],
  imports: [CommonModule, MaterialModule]
})
export class RoleSelectComponent {
  // 👉 para desactivar botones mientras se actualiza
  loading = false;

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private router: Router,
    public  auth: AuthService,
    private dialog: MatDialog
  ) {}

  choose(rol: Rol) {
    const user = this.auth.usuario;
    if (!user) {
      this.snack.open('No hay sesión', 'Cerrar', { duration: 2500 });
      return;
    }

    // ✅ UX: si ya tiene el rol, avisar y no llamar al backend
    if (user.rol === rol) {
      this.snack.open(`Ya tienes el rol "${rol}"`, 'OK', { duration: 2000 });
      return;
    }

    const body: any = { rol };

    const navegarSegunRol = (r: Rol) => {
      // 🔒 /dashboard solo para admin → aquí redirigimos a una vista útil
      // Estudiante y Profesor pueden ir a /cursos (o /mis-clases si prefieres)
      if (r === 'profesor') this.router.navigateByUrl('/cursos'); // o '/mis-clases'
      else this.router.navigateByUrl('/cursos');
    };

    const ejecutarCambio = (profesorClave?: string) => {
      if (profesorClave) {
        // el backend acepta profesorClave o claveProfesor; enviamos una
        body.profesorClave = profesorClave;
      }

      this.loading = true;
      this.api.updateUsuario(user._id, body).subscribe({
        next: (resp) => {
          const u = resp?.usuario;
          if (u) this.auth.usuario = u; // refresca sesión
          this.snack.open('Rol actualizado', 'OK', { duration: 2000 });
          // 👇 no lleves a /dashboard si no es admin
          navegarSegunRol(rol);
          this.loading = false;
        },
        error: (e) => {
          this.loading = false;
          this.snack.open(
            e?.error?.msg || 'No se pudo actualizar el rol',
            'Cerrar',
            { duration: 3000 }
          );
        }
      });
    };

    if (rol === 'profesor') {
      // 👇 si el usuario actual es admin, no pedimos clave
      if (user.rol === 'admin') {
        ejecutarCambio();
        return;
      }

      // Pedimos la clave solo para usuarios no admin
      this.dialog.open(ProfesorKeyDialogComponent, { width: '420px' })
        .afterClosed()
        .subscribe((clave?: string) => {
          if (!clave) return; // cancelado
          ejecutarCambio(clave);
        });
    } else {
      ejecutarCambio();
    }
  }
}