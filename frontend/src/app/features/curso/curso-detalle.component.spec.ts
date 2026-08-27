// Lo que se comprueba aquí es lo que distingue esta pantalla de un listado:
// que un id que no existe se explica en vez de dejar la página en blanco, que
// la acción principal cambia con el estado de la matrícula y que la lista de
// compañeros no se pinta a un estudiante.
//
// El reparto de la lista lo decide el servidor mandando o no `estudiantes`, así
// que el test simula las dos respuestas y comprueba que la pantalla obedece.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CursoDetalleComponent } from './curso-detalle.component';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CursoDetalle } from '../../data/curso.model';

const PROFESOR = { _id: 'p1', id: 'p1', nombre: 'Ana Ruiz', correo: 'ana@x.com', rol: 'profesor' };

const FICHA: CursoDetalle = {
  curso: {
    _id: 'c1',
    titulo: 'Álgebra',
    descripcion: 'Vectores y matrices.',
    profesor: PROFESOR as never,
  },
  matriculados: 2,
};

describe('CursoDetalleComponent', () => {
  let fixture: ComponentFixture<CursoDetalleComponent>;
  let componente: CursoDetalleComponent;
  let api: jasmine.SpyObj<ApiService>;
  let dialogo: { open: jasmine.Spy };

  /** Monta la ficha con el rol y la respuesta del servidor que pida el test. */
  function montar(opciones: {
    rol: string;
    usuario?: Record<string, unknown>;
    ficha?: CursoDetalle | HttpErrorResponse;
    mias?: unknown[];
    confirma?: boolean;
  }) {
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getCursoDetalle',
      'listInscripcionesPorCurso',
      'enrollMe',
      'deleteInscripcion',
    ]);

    const ficha = opciones.ficha ?? FICHA;
    api.getCursoDetalle.and.returnValue(
      ficha instanceof HttpErrorResponse ? throwError(() => ficha) : of(ficha)
    );
    api.listInscripcionesPorCurso.and.returnValue(of(opciones.mias ?? []) as never);
    api.enrollMe.and.returnValue(of({}) as never);
    api.deleteInscripcion.and.returnValue(of(undefined) as never);

    dialogo = {
      open: jasmine
        .createSpy('open')
        .and.returnValue({ afterClosed: () => of(opciones.confirma ?? true) }),
    };

    const auth = {
      rol: signal(opciones.rol),
      usuario: signal(opciones.usuario ?? { id: 'e1', rol: opciones.rol }),
    };

    TestBed.configureTestingModule({
      imports: [CursoDetalleComponent, RouterTestingModule],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: MatDialog, useValue: dialogo },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'c1' })) },
        },
      ],
    });

    fixture = TestBed.createComponent(CursoDetalleComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('un id que no existe se explica, no deja la pantalla en blanco', () => {
    montar({ rol: 'estudiante', ficha: new HttpErrorResponse({ status: 404 }) });

    expect(componente.noExiste()).toBeTrue();
    expect(texto()).toContain('Ese curso no existe');
    // Y hay salida: el botón de volver al listado del que se venía.
    expect(fixture.nativeElement.querySelector('.perdido button')).not.toBeNull();
  });

  it('un id mal formado (400) se cuenta como que no existe', () => {
    montar({ rol: 'estudiante', ficha: new HttpErrorResponse({ status: 400 }) });

    expect(componente.noExiste()).toBeTrue();
  });

  it('un fallo de red es un error, no un curso inexistente', () => {
    montar({ rol: 'estudiante', ficha: new HttpErrorResponse({ status: 0 }) });

    expect(componente.noExiste()).toBeFalse();
    expect(componente.error()).toContain('No se pudo conectar');
  });

  it('el estudiante sin matrícula ve "Matricularme" y matricula', () => {
    montar({ rol: 'estudiante', mias: [] });

    expect(componente.matriculado()).toBeFalse();
    const boton = fixture.nativeElement.querySelector('.ficha__acciones button');
    expect(boton.textContent).toContain('Matricularme');

    boton.click();
    expect(api.enrollMe).toHaveBeenCalledWith('c1');
  });

  it('el estudiante matriculado ve "Cancelar matrícula" y se da de baja', () => {
    montar({ rol: 'estudiante', mias: [{ _id: 'i1', curso: 'c1', estudiante: 'e1' }] });

    expect(componente.matriculado()).toBeTrue();
    const boton = fixture.nativeElement.querySelector('.ficha__acciones button');
    expect(boton.textContent).toContain('Cancelar matrícula');

    boton.click();
    // Pasa por confirmación antes de borrar nada.
    expect(dialogo.open).toHaveBeenCalled();
    expect(api.deleteInscripcion).toHaveBeenCalledWith('i1');
  });

  it('si no se confirma la baja, no se borra nada', () => {
    montar({
      rol: 'estudiante',
      mias: [{ _id: 'i1', curso: 'c1', estudiante: 'e1' }],
      confirma: false,
    });

    fixture.nativeElement.querySelector('.ficha__acciones button').click();

    expect(api.deleteInscripcion).not.toHaveBeenCalled();
  });

  it('el estudiante ve cuántos son y no quiénes', () => {
    montar({ rol: 'estudiante', mias: [] });

    // El servidor no ha mandado `estudiantes`, así que no hay sección.
    expect(componente.puedeVerEstudiantes()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.alumnos')).toBeNull();
    expect(texto()).toContain('2');
  });

  it('el profesor del curso ve la tabla de matriculados que manda el servidor', () => {
    montar({
      rol: 'profesor',
      usuario: { id: 'p1', rol: 'profesor' },
      ficha: {
        ...FICHA,
        estudiantes: [
          { _id: 'e1', nombre: 'Carlos', correo: 'carlos@x.com', rol: 'estudiante' },
          { _id: 'e2', nombre: 'Nuria', correo: 'nuria@x.com', rol: 'estudiante' },
        ] as never,
      },
    });

    expect(componente.puedeVerEstudiantes()).toBeTrue();
    expect(componente.esProfesorPropietario()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.alumnos')).not.toBeNull();
    expect(texto()).toContain('carlos@x.com');

    // Y no se le piden sus propias matrículas: la ficha ya se las trae.
    expect(api.listInscripcionesPorCurso).not.toHaveBeenCalled();
  });

  it('un curso sin nadie matriculado no es un error: lo dice', () => {
    montar({
      rol: 'profesor',
      usuario: { id: 'p1', rol: 'profesor' },
      ficha: { ...FICHA, matriculados: 0, estudiantes: [] },
    });

    expect(componente.puedeVerEstudiantes()).toBeTrue();
    expect(texto()).toContain('Todavía no hay nadie matriculado');
  });

  it('el profesor ajeno no puede gestionar el curso', () => {
    montar({ rol: 'profesor', usuario: { id: 'otro', rol: 'profesor' } });

    expect(componente.esProfesorPropietario()).toBeFalse();
    expect(componente.puedeGestionar()).toBeFalse();
  });

  it('el administrador puede gestionar cualquier curso', () => {
    montar({ rol: 'admin', usuario: { id: 'a1', rol: 'admin' } });

    expect(componente.puedeGestionar()).toBeTrue();
    expect(texto()).toContain('Matricular estudiante');
    expect(texto()).toContain('Editar');
  });

  it('las migas llevan al listado que le toca a cada rol', () => {
    montar({ rol: 'profesor', usuario: { id: 'p1', rol: 'profesor' } });
    expect(componente.seccion().ruta).toBe('/profesor/clases');

    TestBed.resetTestingModule();
    montar({ rol: 'estudiante' });
    expect(componente.seccion().ruta).toBe('/cursos');
  });

  it('el tono del curso es estable y está dentro del círculo', () => {
    montar({ rol: 'estudiante' });

    const tono = componente.tono();
    expect(tono).toBeGreaterThanOrEqual(0);
    expect(tono).toBeLessThan(360);
    // El mismo curso da siempre el mismo color: si no, cambia en cada visita.
    expect(componente.tono()).toBe(tono);
  });
});
