// El login: lo que pasa cuando falla, que es la mitad de la pantalla y no tenía
// ni una rama cubierta. Un mensaje que dice "contraseña incorrecta" cuando el
// servidor está caído manda al usuario a arreglar lo que no está roto, y esa
// distinción vive en core/http-error.ts.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { LoginComponent } from './login.component';
import { limpiarSesion } from '../../../../testing/sesion';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let componente: LoginComponent;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    limpiarSesion();

    TestBed.configureTestingModule({
      imports: [
        LoginComponent,
        NoopAnimationsModule,
        RouterTestingModule.withRoutes([
          { path: 'dashboard', children: [] },
          { path: 'profesor/dashboard', children: [] },
          { path: 'admin', children: [] },
        ]),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LoginComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    limpiarSesion();
    TestBed.resetTestingModule();
  });

  const pidenLogin = () => http.expectOne('/api/auth/login');
  const rellenar = (correo: string, password: string) => {
    componente.form.patchValue({ correo, password });
    fixture.detectChanges();
  };

  it('el formulario es inválido al inicio', () => {
    expect(componente.form.invalid).toBeTrue();
  });

  it('con el formulario vacío no sale a la red: marca los errores', () => {
    componente.onSubmit();

    // El botón nunca está gris: es al pulsar cuando se dice qué falta.
    http.expectNone('/api/auth/login');
    expect(componente.form.get('correo')?.touched).toBeTrue();
    expect(componente.enviando()).toBeFalse();
  });

  it('un correo mal escrito tampoco sale', () => {
    rellenar('esto-no-es-un-correo', 'MiClave123');

    componente.onSubmit();

    http.expectNone('/api/auth/login');
  });

  it('con credenciales buenas entra y va al panel que le toca', async () => {
    const ir = spyOn(router, 'navigateByUrl');
    rellenar('lucia@x.com', 'MiClave123');

    componente.onSubmit();
    expect(componente.enviando()).toBeTrue();

    pidenLogin().flush({
      ok: true,
      token: 'jwt',
      usuario: { _id: 'p1', nombre: 'Lucía', correo: 'lucia@x.com', rol: 'profesor' },
    });

    expect(ir).toHaveBeenCalledWith('/profesor/dashboard');
  });

  it('un 401 dice que las credenciales no valen, y deja reintentar', () => {
    rellenar('lucia@x.com', 'LaQueNoEs');

    componente.onSubmit();
    pidenLogin().flush(
      { ok: false, msg: 'Credenciales incorrectas' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(componente.msg()).toContain('Credenciales incorrectas');
    // Se suelta el bloqueo: si no, un fallo dejaría el formulario muerto.
    expect(componente.enviando()).toBeFalse();
  });

  it('el servidor caído NO se cuenta como contraseña incorrecta', () => {
    rellenar('lucia@x.com', 'MiClave123');

    componente.onSubmit();
    // status 0 es "no se llegó al servidor", y http-error.ts lo distingue a
    // propósito: mandar a alguien a revisar su contraseña cuando lo que hay es
    // un corte de red es mandarlo a arreglar lo que no está roto.
    pidenLogin().error(new ProgressEvent('error'), { status: 0 });

    expect(componente.msg()).not.toContain('incorrect');
    expect(componente.msg().length).toBeGreaterThan(0);
    expect(componente.enviando()).toBeFalse();
  });

  it('un segundo envío mientras el primero está en vuelo no duplica la petición', () => {
    rellenar('lucia@x.com', 'MiClave123');

    componente.onSubmit();
    componente.onSubmit();

    // expectOne falla si hubiera dos.
    pidenLogin().flush({
      ok: true,
      token: 'jwt',
      usuario: { _id: 'e1', nombre: 'Ana', correo: 'ana@x.com', rol: 'estudiante' },
    });
  });

  it('una cuenta de demo rellena el formulario y entra de una', () => {
    const ir = spyOn(router, 'navigateByUrl');

    componente.usarDemo({ correo: 'admin@educontrol.com', password: 'Admin123*' });

    expect(componente.form.value.correo).toBe('admin@educontrol.com');
    pidenLogin().flush({
      ok: true,
      token: 'jwt',
      usuario: { _id: 'a1', nombre: 'Admin', correo: 'admin@educontrol.com', rol: 'admin' },
    });
    expect(ir).toHaveBeenCalledWith('/admin');
  });

  it('el ojo de la contraseña alterna, y arranca oculta', () => {
    expect(componente.hide()).toBeTrue();

    componente.hide.set(false);

    expect(componente.hide()).toBeFalse();
  });
});
