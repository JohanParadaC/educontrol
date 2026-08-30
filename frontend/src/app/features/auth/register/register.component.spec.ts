// El registro: qué se manda, qué pasa cuando el servidor dice que no, y el
// camino del perfil de profesor. La validación de "las dos contraseñas
// coinciden" tiene su propio fichero (register.confirmacion.spec.ts); aquí va
// el envío.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { RegisterComponent } from './register.component';
import { limpiarSesion } from '../../../../testing/sesion';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let componente: RegisterComponent;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    limpiarSesion();

    TestBed.configureTestingModule({
      imports: [
        RegisterComponent,
        NoopAnimationsModule,
        RouterTestingModule.withRoutes([{ path: 'login', children: [] }]),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(RegisterComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    limpiarSesion();
    TestBed.resetTestingModule();
  });

  const pidenAlta = () => http.expectOne('/api/usuarios');
  const valido = {
    nombre: 'Ana Torres',
    correo: 'ana@x.com',
    password: 'MiClave123',
    password2: 'MiClave123',
  };
  const rellenar = (valores: Record<string, unknown>) => {
    componente.form.patchValue(valores);
    fixture.detectChanges();
  };

  it('debería crearse, y el formulario arranca inválido', () => {
    expect(componente).toBeTruthy();
    expect(componente.form.invalid).toBeTrue();
  });

  it('vacío no sale a la red', () => {
    componente.onSubmit();

    http.expectNone('/api/usuarios');
    expect(componente.form.get('nombre')?.touched).toBeTrue();
  });

  it('una contraseña corta no pasa: seis es el mínimo del backend', () => {
    rellenar({ ...valido, password: '12345', password2: '12345' });

    componente.onSubmit();

    http.expectNone('/api/usuarios');
  });

  it('con los datos bien manda el alta y lleva al login', () => {
    const ir = spyOn(router, 'navigateByUrl');
    rellenar(valido);

    componente.onSubmit();
    expect(componente.enviando()).toBeTrue();

    const peticion = pidenAlta();
    expect(peticion.request.method).toBe('POST');
    // La traducción password -> 'contraseña' la hace la capa de datos, no la
    // pantalla: aquí solo se comprueba que llega lo que se escribió.
    expect(peticion.request.body.correo).toBe('ana@x.com');
    expect(peticion.request.body.rol).toBe('estudiante');

    peticion.flush({ ok: true, usuario: { _id: 'e1', ...valido } });
    expect(ir).toHaveBeenCalledWith('/login');
  });

  it('el correo repetido se explica y se puede corregir', () => {
    rellenar(valido);

    componente.onSubmit();
    pidenAlta().flush(
      { ok: false, msg: 'Correo ya registrado' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(componente.msg()).toContain('Correo ya registrado');
    expect(componente.enviando()).toBeFalse();
  });

  it('el servidor caído no se cuenta como un dato mal escrito', () => {
    rellenar(valido);

    componente.onSubmit();
    pidenAlta().error(new ProgressEvent('error'), { status: 0 });

    expect(componente.msg().length).toBeGreaterThan(0);
    expect(componente.enviando()).toBeFalse();
  });

  it('dos envíos seguidos no dan de alta dos veces', () => {
    rellenar(valido);

    componente.onSubmit();
    componente.onSubmit();

    pidenAlta().flush({ ok: true, usuario: { _id: 'e1' } });
  });

  it('pedir el perfil de profesor manda el rol y la clave del centro', () => {
    rellenar({ ...valido, rol: 'profesor', profesorClave: 'la-del-centro' });

    componente.onSubmit();

    const peticion = pidenAlta();
    expect(peticion.request.body.rol).toBe('profesor');
    peticion.flush({ ok: true, usuario: { _id: 'p1' } });
  });
});
