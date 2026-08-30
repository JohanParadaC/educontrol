// El acceso al historial: qué parámetros salen y cómo se normaliza lo que
// vuelve. Son cinco ramas y no había ninguna cubierta: un filtro que se manda
// vacío no es lo mismo que uno que no se manda, y el backend responde distinto.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuditoriaApi } from './auditoria.api';
import { RegistroAuditoria } from './auditoria.model';
import { Pagina } from './paginacion';

const REGISTRO = {
  _id: 'a1',
  actor: 'u1',
  actorNombre: 'Jefa',
  actorRol: 'admin',
  accion: 'rol.cambiado',
  recurso: { tipo: 'usuario', id: 'u2', etiqueta: 'Nuria' },
  createdAt: '2026-08-26T10:30:00.000Z',
} as RegistroAuditoria;

describe('AuditoriaApi', () => {
  let api: AuditoriaApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AuditoriaApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  const pedir = () => http.expectOne(r => r.url === '/api/auditoria');

  it('sin filtros manda solo la paginación', () => {
    api.listar().subscribe();

    const { params } = pedir().request;
    expect(params.get('page')).toBe('1');
    expect(params.get('limit')).toBe('20');
    // Ni `accion` ni `buscar`: un parámetro vacío no es "sin filtro".
    expect(params.has('accion')).toBeFalse();
    expect(params.has('buscar')).toBeFalse();
  });

  it('el filtro de acción viaja cuando lo hay', () => {
    api.listar(2, 50, { accion: 'usuario.borrado' }).subscribe();

    const { params } = pedir().request;
    expect(params.get('page')).toBe('2');
    expect(params.get('limit')).toBe('50');
    expect(params.get('accion')).toBe('usuario.borrado');
  });

  it('la acción vacía —"todas" en el desplegable— no se manda', () => {
    api.listar(1, 20, { accion: '' }).subscribe();

    expect(pedir().request.params.has('accion')).toBeFalse();
  });

  it('el texto de búsqueda va recortado, y en blanco no va', () => {
    api.listar(1, 20, { buscar: '  Nuria  ' }).subscribe();
    expect(pedir().request.params.get('buscar')).toBe('Nuria');

    api.listar(1, 20, { buscar: '   ' }).subscribe();
    expect(pedir().request.params.has('buscar')).toBeFalse();
  });

  it('normaliza la respuesta a una página con sus metadatos', () => {
    let pagina: Pagina<RegistroAuditoria> | undefined;
    api.listar().subscribe(p => (pagina = p));

    pedir().flush({
      ok: true,
      registros: [REGISTRO],
      total: 41,
      pagina: 1,
      limite: 20,
      paginas: 3,
    });

    expect(pagina).toEqual({ items: [REGISTRO], total: 41, pagina: 1, limite: 20, paginas: 3 });
  });

  it('si el backend devolviera un array pelado, sigue saliendo una página', () => {
    let pagina: Pagina<RegistroAuditoria> | undefined;
    api.listar().subscribe(p => (pagina = p));

    pedir().flush([REGISTRO]);

    // El total sale del propio array: mejor un número honesto que un cero.
    expect(pagina).toEqual({ items: [REGISTRO], total: 1, pagina: 1, limite: 20, paginas: 1 });
  });

  it('una respuesta sin la clave esperada da una lista vacía, no un error', () => {
    let pagina: Pagina<RegistroAuditoria> | undefined;
    api.listar().subscribe(p => (pagina = p));

    pedir().flush({ ok: true });

    expect(pagina).toEqual({ items: [], total: 0, pagina: 1, limite: 20, paginas: 1 });
  });

  it('un 500 llega como error al que se suscribe, no como lista vacía', () => {
    let fallo: unknown;
    api.listar().subscribe({ error: e => (fallo = e) });

    pedir().flush({ ok: false }, { status: 500, statusText: 'Server Error' });

    // "No he podido preguntarlo" y "no hay nada" llevan a acciones distintas.
    expect(fallo).toBeTruthy();
  });
});
