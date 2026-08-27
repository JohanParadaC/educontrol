// Lo que se comprueba aquí es lo que no se ve mirando la pantalla llena:
// que un fallo de carga NO se pinte como "no ha pasado nada", que cambiar de
// filtro vuelva a la primera página, y que el resumen del cambio diga qué
// cambió y no solo que algo cambió.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { ActividadComponent } from './actividad.component';
import { ApiService } from '../../core/api.service';
import { RegistroAuditoria } from '../../data/auditoria.model';

const REGISTRO: RegistroAuditoria = {
  _id: 'a1',
  actor: 'u1',
  actorNombre: 'Jefa',
  actorRol: 'admin',
  accion: 'rol.cambiado',
  recurso: { tipo: 'usuario', id: 'u2', etiqueta: 'Nuria' },
  antes: { rol: 'estudiante' },
  despues: { rol: 'profesor' },
  createdAt: '2026-08-26T10:30:00.000Z',
};

function pagina(items: RegistroAuditoria[], total = items.length) {
  return of({ items, total, pagina: 1, limite: 20, paginas: 1 });
}

describe('ActividadComponent', () => {
  let fixture: ComponentFixture<ActividadComponent>;
  let componente: ActividadComponent;
  let api: jasmine.SpyObj<ApiService>;

  function montar(respuesta = pagina([REGISTRO])) {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['listAuditoria']);
    api.listAuditoria.and.returnValue(respuesta as never);

    TestBed.configureTestingModule({
      imports: [ActividadComponent, NoopAnimationsModule],
      providers: [{ provide: ApiService, useValue: api }],
    });

    fixture = TestBed.createComponent(ActividadComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('pinta el historial con quién, qué y sobre qué', () => {
    montar();

    expect(componente.registros().length).toBe(1);
    expect(texto()).toContain('Jefa');
    expect(texto()).toContain('Cambio de rol');
    expect(texto()).toContain('Nuria');
  });

  it('un fallo de carga es un error, no un historial vacío', () => {
    montar(throwError(() => new HttpErrorResponse({ status: 500 })) as never);

    expect(componente.error()).toBeTruthy();
    expect(componente.registros()).toEqual([]);
    // Y no se cuela el mensaje del estado vacío, que diría lo contrario.
    expect(texto()).not.toContain('No hay actividad registrada');
  });

  it('sin registros dice que no hay actividad, que es otra cosa', () => {
    montar(pagina([]));

    expect(componente.error()).toBe('');
    expect(texto()).toContain('No hay actividad registrada');
  });

  it('cambiar el filtro de acción vuelve a la primera página', () => {
    montar();
    componente.onPagina({ pageIndex: 2, pageSize: 20, length: 60 } as never);
    expect(api.listAuditoria).toHaveBeenCalledWith(3, 20, jasmine.anything());

    componente.accion.setValue('curso.borrado');

    // La página vuelve a 1: quedarse en la 3 de un listado que ahora tiene una
    // sola enseñaría un vacío que no lo es.
    expect(api.listAuditoria).toHaveBeenCalledWith(
      1,
      20,
      jasmine.objectContaining({ accion: 'curso.borrado' })
    );
  });

  it('el resumen dice qué cambió, no solo que cambió', () => {
    montar();

    expect(componente.resumen(REGISTRO)).toBe('rol: estudiante → profesor');
  });

  it('el resumen ignora las claves que no cambian', () => {
    montar();

    const editado: RegistroAuditoria = {
      ...REGISTRO,
      accion: 'curso.editado',
      antes: { nombre: 'Álgebra', descripcion: 'Igual', cupoMaximo: null },
      despues: { nombre: 'Álgebra II', descripcion: 'Igual', cupoMaximo: 30 },
    };

    const resumen = componente.resumen(editado);
    expect(resumen).toContain('nombre: Álgebra → Álgebra II');
    expect(resumen).toContain('cupoMaximo: — → 30');
    expect(resumen).not.toContain('descripcion');
  });

  it('una creación no tiene "antes", así que no inventa un resumen', () => {
    montar();

    const creado: RegistroAuditoria = {
      ...REGISTRO,
      accion: 'curso.creado',
      antes: undefined,
      despues: { nombre: 'Álgebra' },
    };

    expect(componente.resumen(creado)).toBe('');
  });

  it('alta, cambio y baja no pesan lo mismo, y el color lo dice', () => {
    montar();

    expect(componente.tono('curso.creado')).toBe('alta');
    expect(componente.tono('matricula.creada')).toBe('alta');
    expect(componente.tono('curso.borrado')).toBe('baja');
    expect(componente.tono('matricula.borrada')).toBe('baja');
    expect(componente.tono('rol.cambiado')).toBe('cambio');
    expect(componente.tono('curso.editado')).toBe('cambio');
  });

  it('una fecha inválida no rompe la fila', () => {
    montar();

    expect(componente.cuando('no es una fecha')).toBe('—');
    expect(componente.cuando(REGISTRO.createdAt)).toMatch(/\d/);
  });
});
