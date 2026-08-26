// src/main.ts
import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';

import { environment } from './environments/environment';
import { routes } from './app/app-routing-module';

import { TokenInterceptor } from './app/core/token.interceptor';
import { AppComponent } from './app/app.component';

import { MatPaginatorIntl } from '@angular/material/paginator';
import { paginatorIntlEs } from './app/shared/paginator-intl';
import { LOCALE_ID } from '@angular/core';

// Declarar LOCALE_ID sin registrar sus datos hace que los pipes de fecha y
// número fallen en tiempo de ejecución. Van juntos, siempre.
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

registerLocaleData(localeEs, 'es');

// Animaciones de Material, cargadas aparte del arranque.
//
// Aquí había un provideNoopAnimations() que las apagaba todas: los diálogos
// aparecían de golpe, los ripples no se veían, el menú móvil no se desplegaba y
// el paginador cambiaba de página a saltos. La versión Async no mete el motor
// de animaciones en el arranque inicial: lo carga cuando hace falta.
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),

    // Importante: habilitar interceptores via DI
    provideHttpClient(withInterceptorsFromDi()),

    provideAnimationsAsync(),

    // Registrar el interceptor
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi: true,
    },

    // La app está en español: fechas, números y textos del paginador también.
    { provide: LOCALE_ID, useValue: 'es' },
    { provide: MatPaginatorIntl, useFactory: paginatorIntlEs },
  ],
}).catch(err => console.error(err));
