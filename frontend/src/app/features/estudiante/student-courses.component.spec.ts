// El catálogo del estudiante: los tres estados, la búsqueda en servidor y que
// un error de carga no se lea como "no hay cursos".
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { StudentCoursesComponent } from './student-courses.component';
import { limpiarSesion, responderRenovacion, sembrarSesion } from '../../../testing/sesion';

const ALUMNO = { id: 'e1', rol: 'estudiante' as const };
const CURSOS = [{ _id: 'c1', nombre: 'Álgebra', descripcion: 'Vectores' }];

describe('StudentCoursesComponent', () => {
  let fixture: ComponentFixture<StudentCoursesComponent>;
  let componente: StudentCoursesComponent;
  let http: HttpTestingController;

  const pidenCursos = () => http.expectOne(r => r.url === '/api/cursos');
  const pidenInscripciones = () => http.expectOne(r => r.url === '/api/inscripciones');

  beforeEach(() => {
    sembrarSesion(ALUMNO);

    TestBed.configureTestingModule({
      imports: [StudentCoursesComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentCoursesComponent);
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

  it('mientras carga pinta esqueletos, no el vacío', () => {
    expect(componente.cargando()).toBeTrue();
    expect(texto()).not.toContain('Todavía no hay cursos publicados');

    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 1 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
  });

  it('con cursos, los pinta y sabe en cuáles ya estás', () => {
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 1 });
    pidenInscripciones().flush({
      ok: true,
      inscripciones: [{ _id: 'i1', curso: CURSOS[0], estudiante: 'e1' }],
      total: 1,
    });
    fixture.detectChanges();

    expect(componente.cursos().length).toBe(1);
    expect(componente.isEnrolled('c1')).toBeTrue();
    expect(texto()).toContain('Ya inscrito');
  });

  it('sin cursos lo dice, y no es un error', () => {
    pidenCursos().flush({ ok: true, cursos: [], total: 0 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    fixture.detectChanges();

    expect(componente.errorCarga()).toBe('');
    expect(texto()).toContain('Todavía no hay cursos publicados');
  });

  it('un fallo se queda en pantalla y NO se lee como catálogo vacío', () => {
    pidenCursos().flush({ ok: false }, { status: 500, statusText: 'Server Error' });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    fixture.detectChanges();

    expect(componente.errorCarga()).toBeTruthy();
    expect(texto()).not.toContain('Todavía no hay cursos publicados');
    expect(texto()).toContain('Reintentar');
  });

  it('la búsqueda la resuelve el servidor, y espera a que dejes de teclear', fakeAsync(() => {
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 1 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });

    componente.q.setValue('alg');
    componente.q.setValue('algo');
    // Antes de los 300 ms no ha salido nada: once pulsaciones no son once
    // búsquedas.
    tick(200);
    http.expectNone(r => r.url === '/api/cursos');

    tick(200);
    const req = pidenCursos();
    expect(req.request.params.get('buscar')).toBe('algo');
    req.flush({ ok: true, cursos: [], total: 0 });
  }));

  it('el fallo de una búsqueda no deja el buscador muerto', fakeAsync(() => {
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 1 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });

    componente.q.setValue('roto');
    tick(300);
    pidenCursos().flush({ ok: false }, { status: 500, statusText: 'Server Error' });
    expect(componente.errorCarga()).toBeTruthy();

    // Y el flujo sigue vivo: la siguiente búsqueda sale igual.
    componente.q.setValue('otra');
    tick(300);
    const req = pidenCursos();
    expect(req.request.params.get('buscar')).toBe('otra');
    req.flush({ ok: true, cursos: CURSOS, total: 1 });
    expect(componente.errorCarga()).toBe('');
  }));
});
