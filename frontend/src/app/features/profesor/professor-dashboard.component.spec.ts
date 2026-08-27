// El panel del profesor: los tres estados, los KPI que salen de los datos y la
// regla que este componente ya traía escrita en un comentario y nadie fijaba —
// un fallo no se convierte en "no tienes cursos".
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ProfessorDashboardComponent } from './professor-dashboard.component';
import { limpiarSesion, responderRenovacion, sembrarSesion } from '../../../testing/sesion';

const PROFE = { id: 'p1', rol: 'profesor' as const, nombre: 'Lucía' };

const CURSOS = [
  { _id: 'c1', nombre: 'Álgebra', descripcion: 'Vectores' },
  { _id: 'c2', nombre: 'Node.js', descripcion: 'Express' },
];

/** Una matrícula de hace `dias` días, para la variación semanal del KPI. */
const matricula = (id: string, curso: unknown, nombre: string, dias: number) => ({
  _id: id,
  curso,
  estudiante: { nombre },
  createdAt: new Date(Date.now() - dias * 86_400_000).toISOString(),
});

describe('ProfessorDashboardComponent', () => {
  let fixture: ComponentFixture<ProfessorDashboardComponent>;
  let componente: ProfessorDashboardComponent;
  let http: HttpTestingController;

  const pidenCursos = () => http.expectOne(r => r.url === '/api/cursos');
  const pidenInscripciones = () => http.expectOne(r => r.url === '/api/inscripciones');

  beforeEach(() => {
    sembrarSesion(PROFE);

    TestBed.configureTestingModule({
      imports: [ProfessorDashboardComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfessorDashboardComponent);
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

  it('mientras carga no dice que no tienes cursos', () => {
    expect(componente.loading()).toBeTrue();
    expect(texto()).not.toContain('Todavía no tienes cursos asignados');

    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
  });

  it('los KPI salen de los datos, no de un número inventado', () => {
    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({
      ok: true,
      inscripciones: [
        matricula('i1', CURSOS[0], 'Ana', 1),
        matricula('i2', CURSOS[0], 'Diego', 30),
        matricula('i3', CURSOS[1], 'Sara', 2),
      ],
      total: 3,
    });
    fixture.detectChanges();

    expect(componente.totalEstudiantes()).toBe(3);
    expect(componente.inscritosPorCurso().get('c1')).toBe(2);
    expect(componente.mediaPorCurso()).toBe(2); // 3 entre 2 cursos, redondeado
    // Solo las de los últimos siete días cuentan como variación.
    expect(componente.variacionSemana()).toContain('+2');
    expect(componente.recientes().length).toBe(3);
  });

  it('las matrículas de cursos ajenos no se cuelan en el recuento', () => {
    pidenCursos().flush({ ok: true, cursos: [CURSOS[0]], total: 1 });
    pidenInscripciones().flush({
      ok: true,
      inscripciones: [
        matricula('i1', CURSOS[0], 'Ana', 1),
        matricula('i9', { _id: 'ajeno', nombre: 'De otro' }, 'Nadie', 1),
      ],
      total: 2,
    });
    fixture.detectChanges();

    expect(componente.totalEstudiantes()).toBe(1);
    expect(texto()).not.toContain('Nadie');
  });

  it('sin cursos lo dice, y no es un error', () => {
    pidenCursos().flush({ ok: true, cursos: [], total: 0 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    fixture.detectChanges();

    expect(componente.error()).toBe('');
    expect(texto()).toContain('Todavía no tienes cursos asignados');
  });

  it('un fallo es un error, nunca "no tienes cursos"', () => {
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    pidenCursos().flush({ ok: false }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(componente.error()).toBeTruthy();
    expect(componente.cursos()).toEqual([]);
    expect(componente.totalEstudiantes()).toBe(0);
    expect(texto()).not.toContain('Todavía no tienes cursos asignados');
  });

  it('reintentar vuelve a pedirlo todo', () => {
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    pidenCursos().flush({ ok: false }, { status: 0, statusText: 'Unknown Error' });
    expect(componente.error()).toContain('No se pudo conectar');

    componente.cargar();
    expect(componente.error()).toBe('');

    pidenCursos().flush({ ok: true, cursos: CURSOS, total: 2 });
    pidenInscripciones().flush({ ok: true, inscripciones: [], total: 0 });
    expect(componente.cursos().length).toBe(2);
  });
});
