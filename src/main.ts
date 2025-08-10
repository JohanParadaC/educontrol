// src/main.ts
import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import {
  provideHttpClient,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS
} from '@angular/common/http';

import { environment } from './environments/environment';

// ✅ Solo UNA importación de `routes`
import { routes } from './app/app-routing-module';

import { TokenInterceptor } from './app/core/token.interceptor';
import { AppComponent } from './app/app.component';

// Animaciones para Angular Material (o usa provideAnimations si las quieres reales)
import { provideNoopAnimations } from '@angular/platform-browser/animations';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    // Rutas raíz (standalone)
    provideRouter(routes),

    // HttpClient + soporte para interceptores DI
    provideHttpClient(withInterceptorsFromDi()),

    // Animaciones (no-op). CAMBIO: si usas animaciones reales, cambia a `provideAnimations()`
    provideNoopAnimations(),

    // Interceptor Bearer para todas las llamadas a /api
    {
      provide : HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi   : true
    }
  ]
}).catch(err => console.error(err));