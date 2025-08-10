// src/app/dashboard/dashboard-routing-module.ts
// -----------------------------------------------------------------------------
// Routing "mínimo" para el folder dashboard. Solo define la ruta '' que
// carga el DashboardComponent. Esto evita los errores de compilación que
// veías y mantiene la compatibilidad si alguna vez decides lazy-load.
// -----------------------------------------------------------------------------

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// 👇 Componente standalone en el mismo folder
import { DashboardComponent } from './dashboard.component';

const routes: Routes = [
  // Ruta base del módulo
  { path: '', component: DashboardComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule {}