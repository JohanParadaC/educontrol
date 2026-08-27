// "Mis cursos": los tres estados y la baja de una matrícula.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { StudentMyCoursesComponent } from './student-my-courses.component';
import { limpiarSesion, responderRenovacion, sembrarSesion } from '../../../testing/sesion';

const ALUMNO = { id: 'e1', rol: 'estudiante' as const };

const MATRICULA = {
  _id: 'i1',
  estudiante: 'e1',
  curso: { _id: 'c1', nombre: 'Álgebra', profesor: { nombre: 'Lucía' } },
};

describe('StudentMyCoursesComponent', () => {
  let fixture: ComponentFixture<StudentMyCoursesComponent>;
  let componente: StudentMyCoursesComponent;
  let http: HttpTestingController;

  const piden = () => http.expectOne(r => r.url === '/api/inscripciones');

  beforeEach(() => {
    sembrarSesion(ALUMNO);

    TestBed.configureTestingModule({
      imports: [StudentMyCoursesComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentMyCoursesComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    responderRenovacion(http, ALUMNO);
  });

  afterEach(() => {
    http.verify();
    limpiarSesion();
    TestBed.resetTestingModule();
  });

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('mientras carga no dice ni que hay ni que no hay', () => {
    expect(componente.cargando()).toBeTrue();
    expect(texto()).not.toContain('Aún no tienes cursos');

    piden().flush({ ok: true, inscripciones: [], total: 0 });
  });

  it('con matrículas, las pinta con el título traducido por el mapper', () => {
    piden().flush({ ok: true, inscripciones: [MATRICULA], total: 1 });
    fixture.detectChanges();

    expect(componente.inscripciones().length).toBe(1);
    expect(texto()).toContain('Álgebra');
    expect(componente.error()).toBe('');
  });

  it('sin matrículas lo dice, y eso NO es un error', () => {
    piden().flush({ ok: true, inscripciones: [], total: 0 });
    fixture.detectChanges();

    expect(componente.error()).toBe('');
    expect(texto()).toContain('Aún no tienes cursos');
  });

  it('un fallo se pinta como fallo, nunca como lista vacía', () => {
    piden().flush({ ok: false }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(componente.error()).toBeTruthy();
    expect(componente.inscripciones()).toEqual([]);
    // La diferencia que importa: "no tienes cursos" manda a matricularse,
    // "no he podido preguntarlo" manda a reintentar.
    expect(texto()).not.toContain('Aún no tienes cursos');
  });

  it('darse de baja quita la fila solo si el servidor dice que sí', () => {
    piden().flush({ ok: true, inscripciones: [MATRICULA], total: 1 });

    componente.desmatricular(componente.inscripciones()[0]);
    expect(componente.cancelandoId()).toBe('i1');

    const req = http.expectOne('/api/inscripciones/i1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });

    expect(componente.inscripciones()).toEqual([]);
    expect(componente.cancelandoId()).toBeNull();
  });

  it('si la baja falla, la matrícula sigue en la lista', () => {
    piden().flush({ ok: true, inscripciones: [MATRICULA], total: 1 });

    componente.desmatricular(componente.inscripciones()[0]);
    http
      .expectOne('/api/inscripciones/i1')
      .flush(
        { ok: false, msg: 'Esta matrícula no es tuya' },
        { status: 403, statusText: 'Forbidden' }
      );

    expect(componente.inscripciones().length).toBe(1);
    expect(componente.cancelandoId()).toBeNull();
  });
});
