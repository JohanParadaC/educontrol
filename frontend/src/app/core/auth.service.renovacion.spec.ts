import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';

import { AuthService } from './auth.service';
import { ApiService } from './api.service';

/**
 * Regresión: una renovación de token que falla no puede cerrar una sesión que
 * se ha iniciado mientras esa petición estaba en vuelo.
 *
 * El síntoma era "inicio sesión y me devuelve al login un segundo después".
 */
describe('AuthService — renovación de token en vuelo', () => {
  const usuario: any = { _id: 'u1', nombre: 'Ana', correo: 'ana@mail.com', rol: 'estudiante' };

  /** Construye el servicio con un ApiService falso. */
  const crear = (api: Partial<ApiService>) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [AuthService, { provide: ApiService, useValue: api }],
    });
    return TestBed.inject(AuthService);
  };

  afterEach(() => localStorage.clear());

  it('cierra sesión si la renovación falla y nadie ha vuelto a entrar', () => {
    localStorage.setItem('token', 'token-viejo');

    crear({
      renew: () => throwError(() => ({ status: 401 })),
      login: () => of({ token: 'nuevo', usuario }),
    } as any);

    expect(localStorage.getItem('token')).toBeNull();
  });

  it('NO cierra sesión si mientras tanto se ha iniciado una nueva', () => {
    localStorage.setItem('token', 'token-viejo');

    // La renovación queda pendiente para poder colar el login antes del fallo.
    const renovacion = new Subject<any>();
    const auth = crear({
      renew: () => renovacion.asObservable(),
      login: () => of({ token: 'token-nuevo', usuario }),
    } as any);

    // El usuario entra correctamente mientras la renovación sigue en vuelo.
    auth.login({ correo: 'ana@mail.com', password: 'x' }).subscribe();
    expect(localStorage.getItem('token')).toBe('token-nuevo');

    // Ahora falla la renovación del token ANTIGUO.
    renovacion.error({ status: 401 });

    // La sesión nueva sobrevive.
    expect(localStorage.getItem('token')).toBe('token-nuevo');
    expect(auth.estaAutenticado()).toBeTrue();
  });

  it('una renovación correcta que llega tarde tampoco pisa la sesión nueva', () => {
    localStorage.setItem('token', 'token-viejo');

    const renovacion = new Subject<any>();
    const auth = crear({
      renew: () => renovacion.asObservable(),
      login: () => of({ token: 'token-nuevo', usuario }),
    } as any);

    auth.login({ correo: 'ana@mail.com', password: 'x' }).subscribe();
    renovacion.next({ token: 'token-renovado-del-viejo', usuario });

    expect(localStorage.getItem('token')).toBe('token-nuevo');
  });
});
