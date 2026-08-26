// src/app/core/token.interceptor.spec.ts
// ---------------------------------------------------------------------------
// Regresión: con una sesión guardada, arrancar la aplicación no puede cerrarla.
//
// AuthService valida el token en su constructor. Esa validación dispara una
// petición HTTP, la petición construye el interceptor y el interceptor
// inyectaba AuthService... que todavía se estaba construyendo. Angular
// respondía NG0200 (dependencia circular) y la petición moría ahí, sin salir
// al servidor. Como la renovación "fallaba", AuthService hacía logout.
//
// Visto desde fuera: inicias sesión, refrescas la página y estás en el login.
//
// Los tests que ya había no lo cogían porque sustituían ApiService por un
// doble: sin HttpClient real no hay interceptor, y sin interceptor no hay
// ciclo. Este monta el grafo de verdad.
// ---------------------------------------------------------------------------
import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { TokenInterceptor } from './token.interceptor';

describe('TokenInterceptor — arranque con sesión guardada', () => {
  const usuario = { _id: 'u1', nombre: 'Ana', correo: 'ana@mail.com', rol: 'estudiante' as const };

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => localStorage.clear());

  /** Arranca AuthService con el interceptor registrado, como en la aplicación real. */
  function arrancarConSesion() {
    localStorage.setItem('token', 'token-guardado');
    localStorage.setItem('usuario', JSON.stringify(usuario));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
        AuthService,
      ],
    });

    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    return { auth, http };
  }

  it('la renovación sale de verdad hacia el servidor, con su cabecera', () => {
    const { http } = arrancarConSesion();

    const peticion = http.expectOne(r => r.url.endsWith('/auth/renew'));
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer token-guardado');

    peticion.flush({ token: 'token-renovado', usuario });
    http.verify();
  });

  it('la sesión sobrevive al arranque', () => {
    const { auth, http } = arrancarConSesion();

    http.expectOne(r => r.url.endsWith('/auth/renew')).flush({ token: 'token-renovado', usuario });

    expect(localStorage.getItem('token')).toBe('token-renovado');
    expect(auth.isLoggedIn).toBeTrue();
    http.verify();
  });

  it('no toca las peticiones que no van a la API', () => {
    localStorage.setItem('token', 'token-guardado');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
      ],
    });

    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(HttpClient).get('/assets/config.json').subscribe();

    // Un recurso estático no lleva el token encima.
    const peticion = http.expectOne('/assets/config.json');
    expect(peticion.request.headers.has('Authorization')).toBeFalse();
    peticion.flush({});
    http.verify();
  });
});
