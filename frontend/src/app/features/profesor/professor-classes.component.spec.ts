// "Mis clases": los tres estados, el recuento por curso y la exportación.
//
// Aquí hay una degradación deliberada que conviene fijar: si fallan las
// inscripciones, los cursos SE SIGUEN VIENDO sin recuento. Es lo contrario del
// caso general —un error no se convierte en lista vacía— porque el dato
// esencial de la pantalla son los cursos, y quedarse sin el número es peor que
// nada pero mejor que una pantalla en blanco.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ProfessorClassesComponent } from './professor-classes.component';
import { limpiarSesion, responderRenovacion, sembrarSesion } from '../../../testing/sesion';

const PROFE = { id: 'p1', rol: 'profesor' as const };

const CURSOS = [
  { _id: 'c1', nombre: 'Álgebra', descripcion: 'Vectores', cupoMaximo: 2 },
  { _id: 'c2', nombre: 'Node.js', descripcion: 'Express' },
];

const INSCRIPCIONES = [
  { _id: 'i1', curso: CURSOS[0], estudiante: { nombre: 'Ana' } },
  { _id: 'i2', curso: CURSOS[0], estudiante: { nombre: 'Diego' } },
];

describe('ProfessorClassesComponent', () => {
  let fixture: ComponentFixture<ProfessorClassesComponent>;
  let componente: ProfessorClassesComponent;
  let http: HttpTestingController;

  const pidenCursos = () => http.expectOne(r => r.url === '/api/cursos');
  const pidenInscripciones = () => http.expectOne(r => r.url === '/api/inscripciones');

  beforeEach(() => {
    sembrarSesion(PROFE);

    TestBed.configureTestingModule({
      imports: [ProfessorClassesComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfessorClassesComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    responderRenovacion(http, PROFE);
  });

  afterEach(() => {
    http.verify();
    limpiarSesion();
    TestBed.resetTestingModule();
  });

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('pide solo sus cursos, no el catálogo entero', () => {
    const req = pidenCursos();
    expect(req.request.params.get('profesor')).toBe('me');
    req.flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
  });

  it('mientras carga no dice que no tienes cursos', () => {
    expect(componente.loading()).toBeTrue();
    expect(texto()).not.toContain('Todavía no tienes cursos asignados');

    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
  });

  it('cuenta los matriculados por curso y marca el que está lleno', () => {
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: true, inscripciones: INSCRIPCIONES, total: 2 });
    fixture.detectChanges();

    expect(componente.inscritos().get('c1')).toBe(2);
    expect(componente.inscritos().get('c2')).toBeUndefined();
    expect(componente.lleno(componente.cursos()[0])).toBeTrue();
    // Sin cupo nunca está lleno, por muchos que haya.
    expect(componente.lleno(componente.cursos()[1])).toBeFalse();
    expect(texto()).toContain('2 / 2 plazas');
  });

  it('sin cursos lo dice, y no es un error', () => {
    pidenCursos().flush({ ok: true, cursos: [], total: 0 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    fixture.detectChanges();

    expect(componente.error()).toBe('');
    expect(texto()).toContain('Todavía no tienes cursos asignados');
  });

  it('que fallen los cursos es un error, no una lista vacía', () => {
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    pidenCursos().flush({ ok: false }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(componente.error()).toBeTruthy();
    expect(texto()).not.toContain('Todavía no tienes cursos asignados');
  });

  it('que fallen las inscripciones deja los cursos, sin recuento', () => {
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: false }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    // La degradación deliberada: los cursos son el dato esencial y siguen ahí.
    expect(componente.error()).toBe('');
    expect(componente.cursos().length).toBe(2);
    expect(componente.inscritos().size).toBe(0);
    expect(texto()).toContain('Álgebra');
  });

  it('exportar pide el CSV de ESE curso y bloquea solo su botón', () => {
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });

    componente.exportar(componente.cursos()[0]);
    expect(componente.exportandoId()).toBe('c1');

    const req = http.expectOne('/api/cursos/c1/estudiantes.csv');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x'], { type: 'text/csv' }));

    expect(componente.exportandoId()).toBe('');
  });

  it('si la exportación falla, se suelta el bloqueo y se puede reintentar', () => {
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });

    componente.exportar(componente.cursos()[0]);
    http
      .expectOne('/api/cursos/c1/estudiantes.csv')
      .flush(null, { status: 403, statusText: 'Forbidden' });

    expect(componente.exportandoId()).toBe('');
  });
});
