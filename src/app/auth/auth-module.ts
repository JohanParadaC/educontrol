import { NgModule }            from '@angular/core';
import { CommonModule }        from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

/* Angular Material agrupado (si lo tienes) */
import { MaterialModule }      from '../shared/material.module';

/* Rutas de auth (login/register) */
import { AuthRoutingModule }   from './auth-routing-module';

/* Componentes stand-alone para auth */
import { LoginComponent }      from './login/login.component';
// import { RegisterComponent } from './register/register.component'; // descomenta si lo implementas

@NgModule({
  // 🚨 Como todos tus componentes de auth son standalone,
  //    NO van en `declarations`, sino en `imports`.
  declarations: [
    // Solo pondrías aquí componentes “tradicionales” (no standalone)
  ],
  imports: [
    CommonModule,           // para NgIf, NgFor si los usas dentro de este módulo
    ReactiveFormsModule,    // para formularios reactivos
    MaterialModule,         // toolbar, card, form-field, etc.
    AuthRoutingModule,      // rutas /auth/login y /auth/register
    LoginComponent          // componente standalone de login
    // , RegisterComponent   // componente standalone de registro
  ]
})
export class AuthModule {}