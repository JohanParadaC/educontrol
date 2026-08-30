// El contrato con /api/cursos: la traducción nombre↔titulo del camino real, los
// filtros que viajan al servidor y las dos formas en que puede llegar una
// respuesta (envuelta o pelada). Es la capa donde un `??` de más deja de doler
// en nueve sitios a la vez.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CursosApi } from './cursos.api';
import { Curso, CursoDetalle } from './curso.model';
import { Pagina } from './paginacion';

describe('CursosApi', () => {
  let api: CursosApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CursosApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  const pedirLista = () => http.expectOne(r => r.url === '/api/cursos');

  describe('nombre ↔ titulo', () => {
    it('el listado traduce nombre a titulo', () => {
      let cursos: Curso[] | undefined;
      api.getCursos().subscribe(c => (cursos = c));

      pedirLista().flush({ ok: true, cursos: [{ _id: 'c1', nombre: 'Álgebra' }] });

      expect(cursos?.[0].titulo).toBe('Álgebra');
    });

    it('un array pelado también se traduce', () => {
      let cursos: Curso[] | undefined;
      api.getCursos().subscribe(c => (cursos = c));

      pedirLista().flush([{ _id: 'c1', nombre: 'Node' }]);

      expect(cursos?.[0].titulo).toBe('Node');
    });

    it('una respuesta sin cursos da lista vacía, no un fallo', () => {
      let cursos: Curso[] | undefined;
      api.getCursos().subscribe(c => (cursos = c));

      pedirLista().flush({ ok: true });

      expect(cursos).toEqual([]);
    });

    it('la ficha se desenvuelve del sobre { ok, curso }', () => {
      let curso: Curso | undefined;
      api.getCurso('c1').subscribe(c => (curso = c));

      http.expectOne('/api/cursos/c1').flush({ ok: true, curso: { _id: 'c1', nombre: 'Álgebra' } });

      expect(curso?.titulo).toBe('Álgebra');
    });

    it('al crear y al editar, titulo sale como nombre', () => {
      api.createCurso({ titulo: 'Álgebra', descripcion: 'Vectores' }).subscribe();
      const alta = http.expectOne('/api/cursos');
      expect(alta.request.body).toEqual({ nombre: 'Álgebra', descripcion: 'Vectores' });
      alta.flush({ ok: true, curso: { _id: 'c1', nombre: 'Álgebra' } });

      api.updateCurso('c1', { titulo: 'Álgebra II' }).subscribe();
      const edicion = http.expectOne('/api/cursos/c1');
      expect(edicion.request.method).toBe('PUT');
      expect(edicion.request.body).toEqual({ nombre: 'Álgebra II' });
      edicion.flush({ ok: true, curso: { _id: 'c1', nombre: 'Álgebra II' } });
    });
  });

  describe('la ficha con su contexto', () => {
    it('trae los matriculados y, si el servidor la manda, la lista', () => {
      let detalle: CursoDetalle | undefined;
      api.getCursoDetalle('c1').subscribe(d => (detalle = d));

      http.expectOne('/api/cursos/c1').flush({
        ok: true,
        curso: { _id: 'c1', nombre: 'Álgebra' },
        matriculados: 2,
        estudiantes: [{ _id: 'e1', nombre: 'Ana' }],
      });

      expect(detalle?.curso.titulo).toBe('Álgebra');
      expect(detalle?.matriculados).toBe(2);
      expect(detalle?.estudiantes?.length).toBe(1);
    });

    it('sin permiso, `estudiantes` queda undefined y NO como lista vacía', () => {
      let detalle: CursoDetalle | undefined;
      api.getCursoDetalle('c1').subscribe(d => (detalle = d));

      http
        .expectOne('/api/cursos/c1')
        .flush({ ok: true, curso: { _id: 'c1', nombre: 'Álgebra' }, matriculados: 30 });

      // La ficha usa la PRESENCIA de la clave como señal de permiso: `[]`
      // significaría "no hay ninguno", que es otra cosa.
      expect(detalle?.estudiantes).toBeUndefined();
      expect(detalle?.matriculados).toBe(30);
    });

    it('la marca de recorte llega tal cual cuando el servidor la manda', () => {
      let detalle: CursoDetalle | undefined;
      api.getCursoDetalle('c1').subscribe(d => (detalle = d));

      http.expectOne('/api/cursos/c1').flush({
        ok: true,
        curso: { _id: 'c1', nombre: 'Álgebra' },
        matriculados: 340,
        estudiantes: [],
        estudiantesTruncados: true,
      });

      expect(detalle?.estudiantesTruncados).toBeTrue();
    });

    it('sin matriculados en la respuesta cuenta cero, no NaN', () => {
      let detalle: CursoDetalle | undefined;
      api.getCursoDetalle('c1').subscribe(d => (detalle = d));

      http.expectOne('/api/cursos/c1').flush({ ok: true, curso: { _id: 'c1', nombre: 'X' } });

      expect(detalle?.matriculados).toBe(0);
    });
  });

  describe('los filtros los aplica el servidor', () => {
    it('sin filtros no manda parámetros vacíos', () => {
      api.listCursos().subscribe();

      const { params } = pedirLista().request;
      expect(params.has('profesor')).toBeFalse();
      expect(params.has('buscar')).toBeFalse();
      // El listado sin paginador propio pide el tope duro del backend.
      expect(params.get('limit')).toBe('100');
    });

    it('el texto de búsqueda viaja recortado; en blanco no viaja', () => {
      api.listCursos({ buscar: '  álgebra  ' }).subscribe();
      expect(pedirLista().request.params.get('buscar')).toBe('álgebra');

      api.listCursos({ buscar: '   ' }).subscribe();
      expect(pedirLista().request.params.has('buscar')).toBeFalse();
    });

    it('?profesor=me lo resuelve el servidor, no el navegador', () => {
      api.listCursos({ profesor: 'me' }).subscribe();

      expect(pedirLista().request.params.get('profesor')).toBe('me');
    });

    it('el listado paginado conserva los metadatos y traduce los títulos', () => {
      let pagina: Pagina<Curso> | undefined;
      api.listCursosPaginado(2, 20).subscribe(p => (pagina = p));

      const peticion = pedirLista();
      expect(peticion.request.params.get('page')).toBe('2');
      peticion.flush({
        ok: true,
        cursos: [{ _id: 'c1', nombre: 'Álgebra' }],
        total: 41,
        pagina: 2,
        limite: 20,
        paginas: 3,
      });

      expect(pagina?.total).toBe(41);
      expect(pagina?.items[0].titulo).toBe('Álgebra');
    });
  });

  it('la descarga del CSV pide el blob y la respuesta entera', () => {
    api.descargarEstudiantesCsv('c1').subscribe();

    const peticion = http.expectOne('/api/cursos/c1/estudiantes.csv');
    // Blob porque la API exige el token en una cabecera y un <a href> no la
    // manda; y la respuesta entera porque el nombre del fichero viene en
    // Content-Disposition y lo decide el servidor.
    expect(peticion.request.responseType).toBe('blob');
    peticion.flush(new Blob(['x'], { type: 'text/csv' }));
  });

  it('borrar no devuelve cuerpo', () => {
    let hecho = false;
    api.deleteCurso('c1').subscribe(() => (hecho = true));

    http.expectOne('/api/cursos/c1').flush(null);

    expect(hecho).toBeTrue();
  });
});
