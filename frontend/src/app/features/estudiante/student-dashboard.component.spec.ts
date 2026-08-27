// Los tres estados del panel del estudiante, y sobre todo el tercero: que un
// fallo de carga NO se pinte como "aún no tienes cursos".
//
// Este componente traía las dos peticiones con `catchError(() => of([]))`, así
// que un servidor caído se leía como catálogo vacío. Estos tests fijan que ya
// no.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { StudentDashboardComponent } from './student-dashboard.component';
import { limpiarSesion, responderRenovacion, sembrarSesion } from '../../../testing/sesion';

const ALUMNO = { id: 'e1', rol: 'estudiante' as const };

const CURSOS = [
  { _id: 'c1', nombre: 'Álgebra', descripcion: 'Vectores' },
  { _id: 'c2', nombre: 'Node.js', descripcion: 'Express' },
];

describe('StudentDashboardComponent', () => {
  let fixture: ComponentFixture<StudentDashboardComponent>;
  let componente: StudentDashboardComponent;
  let http: HttpTestingController;

  const pidenCursos = () => http.expectOne(r => r.url === '/api/cursos');
  const pidenInscripciones = () => http.expectOne(r => r.url === '/api/inscripciones');

  beforeEach(() => {
    sembrarSesion(ALUMNO);

    TestBed.configureTestingModule({
      imports: [StudentDashboardComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentDashboardComponent);
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

  it('mientras carga, ni vacío ni error', () => {
    expect(componente.loadingCursos()).toBeTrue();
    expect(componente.error()).toBe('');
    expect(texto()).not.toContain('Aún no estás matriculado');

    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
  });

  it('con datos, separa lo tuyo de lo que queda por explorar', () => {
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({
      ok: true,
      inscripciones: [{ _id: 'i1', curso: CURSOS[0], estudiante: 'e1' }],
      total: 1,
    });
    fixture.detectChanges();

    expect(componente.misCursosCards().map(c => c.titulo)).toEqual(['Álgebra']);
    expect(componente.cursosDisponibles().map(c => c.titulo)).toEqual(['Node.js']);
    expect(componente.error()).toBe('');
  });

  it('sin matrículas dice que no hay ninguna, que es verdad', () => {
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    fixture.detectChanges();

    expect(componente.error()).toBe('');
    expect(texto()).toContain('Aún no estás matriculado');
  });

  it('un fallo NO se pinta como "no tienes cursos"', () => {
    // Se responde primero la que va bien: forkJoin cancela a su hermana en
    // cuanto una falla, y una petición cancelada ya no se puede responder.
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    pidenCursos().flush({ ok: false }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(componente.error()).toBeTruthy();
    expect(texto()).not.toContain('Aún no estás matriculado');
    expect(texto()).not.toContain('No hay cursos publicados');
    expect(componente.loadingCursos()).toBeFalse();
  });

  it('un fallo de red lo dice como fallo de red, y se puede reintentar', () => {
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    pidenCursos().flush({ ok: false }, { status: 0, statusText: 'Unknown Error' });
    fixture.detectChanges();

    expect(componente.error()).toContain('No se pudo conectar');
    expect(texto()).toContain('No se pudo conectar');

    componente.cargar();
    expect(componente.error()).toBe('');
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    fixture.detectChanges();

    expect(componente.cursos().length).toBe(2);
  });
});
