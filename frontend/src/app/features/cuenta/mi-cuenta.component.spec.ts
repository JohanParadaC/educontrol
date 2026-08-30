// "Mi cuenta": lo que se comprueba aquí es la asimetría que el backend acaba de
// cerrar — cambiarse el correo pide la contraseña actual, cambiarse el nombre
// no— y que el formulario no cobre ese peaje cuando no toca.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MiCuentaComponent } from './mi-cuenta.component';
import { limpiarSesion, responderRenovacion, sembrarSesion } from '../../../testing/sesion';

const YO = {
  id: 'u1',
  rol: 'estudiante' as const,
  nombre: 'Ana Torres',
  correo: 'ana@x.com',
};

describe('MiCuentaComponent', () => {
  let fixture: ComponentFixture<MiCuentaComponent>;
  let componente: MiCuentaComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    sembrarSesion(YO);

    TestBed.configureTestingModule({
      imports: [MiCuentaComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MiCuentaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    responderRenovacion(http, YO);
  });

  afterEach(() => {
    http.verify();
    limpiarSesion();
    TestBed.resetTestingModule();
  });

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const escribirCorreo = (valor: string) => {
    componente.perfil.controls['correo'].setValue(valor);
    fixture.detectChanges();
  };

  it('arranca con los datos de la sesión y sin pedir contraseña', () => {
    expect(componente.perfil.value.nombre).toBe('Ana Torres');
    expect(componente.perfil.value.correo).toBe('ana@x.com');
    expect(componente.cambiaElCorreo()).toBeFalse();
    expect(texto()).not.toContain('Tu contraseña actual');
  });

  it('cambiarse solo el nombre no pide contraseña y manda los dos campos', () => {
    componente.perfil.controls['nombre'].setValue('Ana T.');
    fixture.detectChanges();

    expect(componente.cambiaElCorreo()).toBeFalse();
    componente.guardarPerfil();

    const peticion = http.expectOne('/api/usuarios/u1');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({ nombre: 'Ana T.', correo: 'ana@x.com' });
    // La contraseña no se pasea por la red para cambiarse el nombre.
    expect(peticion.request.body.contraseñaActual).toBeUndefined();

    peticion.flush({ ok: true, usuario: { ...YO, nombre: 'Ana T.' } });

    expect(componente.errorPerfil()).toBe('');
    expect(componente.guardandoPerfil()).toBeFalse();
    // La sesión guardada se queda con el nombre nuevo, no con el de antes.
    expect(componente.auth.usuario()?.nombre).toBe('Ana T.');
  });

  it('al escribir un correo distinto aparece el campo de contraseña', () => {
    escribirCorreo('otra@x.com');

    expect(componente.cambiaElCorreo()).toBeTrue();
    expect(texto()).toContain('Tu contraseña actual');
  });

  it('el mismo correo con otras mayúsculas no cuenta como cambio', () => {
    escribirCorreo('ANA@X.com');

    // El backend guarda en minúsculas: pedir la contraseña por un cambio que no
    // existe sería cobrar un peaje inventado.
    expect(componente.cambiaElCorreo()).toBeFalse();
    expect(texto()).not.toContain('Tu contraseña actual');
  });

  it('sin escribir la contraseña, el envío no sale a la red', () => {
    escribirCorreo('otra@x.com');

    componente.guardarPerfil();

    // El formulario es inválido: no hay petición que verificar.
    http.expectNone('/api/usuarios/u1');
    expect(componente.perfil.controls['contraseñaActual'].hasError('required')).toBeTrue();
  });

  it('con la contraseña, el cambio de correo sale con ella', () => {
    escribirCorreo('otra@x.com');
    componente.perfil.controls['contraseñaActual'].setValue('MiClave123');
    fixture.detectChanges();

    componente.guardarPerfil();

    const peticion = http.expectOne('/api/usuarios/u1');
    expect(peticion.request.body).toEqual({
      nombre: 'Ana Torres',
      correo: 'otra@x.com',
      contraseñaActual: 'MiClave123',
    });

    peticion.flush({ ok: true, usuario: { ...YO, correo: 'otra@x.com' } });
    // Guardada la sesión nueva, el campo se vacía y deja de pedirse.
    expect(componente.perfil.value.contraseñaActual).toBe('');
    expect(componente.cambiaElCorreo()).toBeFalse();
  });

  it('si el servidor lo rechaza, se dice y no se traga el error', () => {
    escribirCorreo('otra@x.com');
    componente.perfil.controls['contraseñaActual'].setValue('LA-QUE-NO-ES');
    fixture.detectChanges();

    componente.guardarPerfil();

    http
      .expectOne('/api/usuarios/u1')
      .flush(
        { ok: false, msg: 'La contraseña actual no es correcta' },
        { status: 403, statusText: 'Forbidden' }
      );

    expect(componente.errorPerfil()).toContain('La contraseña actual no es correcta');
    expect(componente.guardandoPerfil()).toBeFalse();
  });

  it('volver a poner el correo de siempre limpia lo escrito y no lo manda', () => {
    escribirCorreo('otra@x.com');
    componente.perfil.controls['contraseñaActual'].setValue('MiClave123');

    escribirCorreo('ana@x.com');

    expect(componente.cambiaElCorreo()).toBeFalse();
    expect(componente.perfil.value.contraseñaActual).toBe('');
  });
});
