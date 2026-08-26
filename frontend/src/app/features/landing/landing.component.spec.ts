// Lo que se comprueba aquí no es que la portada "se cree", sino las dos cosas
// que puede romper un cambio de maquetación sin que salte nada:
//
//   1. que las tarjetas de perfil apunten a un paso que existe de verdad, y
//   2. que los botones de demostración entren, y que si el servidor dice que no
//      se vea el motivo en vez de quedarse la página muda.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { LandingComponent } from './landing.component';
import { AuthService } from '../../core/auth.service';

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;
  let componente: LandingComponent;
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  /** AuthService de mentira: la portada solo necesita entrar y saber quién es. */
  function montar(usuario: { rol: string } | null = { rol: 'admin' }) {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login'], {
      estaAutenticado: signal(false),
      usuario: signal(usuario),
    } as unknown as AuthService);

    TestBed.configureTestingModule({
      imports: [LandingComponent, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: auth }],
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));

    fixture = TestBed.createComponent(LandingComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('cada tarjeta de perfil enlaza con un paso que existe en la página', () => {
    montar();
    const html: HTMLElement = fixture.nativeElement;

    const enlaces = Array.from(html.querySelectorAll<HTMLAnchorElement>('.perfil'));
    expect(enlaces.length).toBe(3);

    for (const a of enlaces) {
      const destino = a.getAttribute('href') ?? '';
      expect(destino.startsWith('#')).withContext(`href de ${a.textContent}`).toBeTrue();
      expect(html.querySelector(destino))
        .withContext(`el ancla ${destino} tiene que existir`)
        .not.toBeNull();
    }
  });

  it('hay un botón de demostración por rol y entra con esa cuenta', () => {
    montar();
    auth.login.and.returnValue(of({ token: 't', usuario: { rol: 'admin' } }) as never);

    const botones = fixture.nativeElement.querySelectorAll('.demo__rol button');
    expect(botones.length).toBe(3);

    botones[0].click();

    expect(auth.login).toHaveBeenCalledWith({
      correo: 'admin@educontrol.com',
      password: 'Admin123*',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('si el login de demostración falla, lo dice y no navega', () => {
    montar();
    auth.login.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })) as never);

    fixture.nativeElement.querySelector('.demo__rol button').click();
    fixture.detectChanges();

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.demo__error')?.textContent).toContain(
      'No se pudo conectar'
    );
    // Y se puede reintentar: el bloqueo del doble envío se ha soltado.
    expect(componente.entrando()).toBe('');
  });

  it('con sesión iniciada no se queda en la portada', () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login'], {
      estaAutenticado: signal(true),
      usuario: signal({ rol: 'profesor' }),
    } as unknown as AuthService);

    TestBed.configureTestingModule({
      imports: [LandingComponent, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: auth }],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));

    TestBed.createComponent(LandingComponent);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/profesor/dashboard');
  });
});
