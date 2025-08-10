// src/app/dashboard/dashboard-module.ts
// -----------------------------------------------------------------------------
// Módulo "de cortesía" para que el compilador no falle si analiza NgModules.
// Tu app arranca en modo standalone con main.ts (bootstrapApplication), pero
// este módulo sigue siendo válido y *combinable* con componentes standalone.
//
// NOTA: NO declaramos componentes standalone en `declarations` (debe ir vacío).
//       Para usar componentes standalone dentro de un NgModule, se agregan en
//       `imports` (Angular 15+).
// -----------------------------------------------------------------------------

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatTableModule } from '@angular/material/table';
import { MatCardModule }  from '@angular/material/card';

// 👇 Este routing ahora SÍ existe y exporta DashboardRoutingModule
import { DashboardRoutingModule } from './dashboard-routing-module';

// 👇 Ambos componentes deben ser *standalone*. Si no usas Home, puedes quitarlo.
import { DashboardComponent } from './dashboard.component';
import { HomeComponent }      from './home/home.component';

@NgModule({
  // ⚠️ En NgModules clásicos, aquí irían pipes/directivas NO standalone.
  //    Como tus componentes son standalone, `declarations` se queda vacío.
  declarations: [],
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,

    // 👇 Ruta '' → DashboardComponent (definida en dashboard-routing-module.ts)
    DashboardRoutingModule,

    // 👇 Importamos componentes standalone para que el módulo compile sin quejas
    DashboardComponent,
    HomeComponent
  ]
})
export class DashboardModule {}