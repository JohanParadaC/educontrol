// El contrato con /api/inscripciones. Dos cosas que solo se ven aquí: que el
// curso poblado pasa por el mapper —sin eso "Mis cursos" pintaba un guión en
// lugar del título— y que la respuesta al matricular llega de dos formas, con
// sobre y sin él.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { InscripcionesApi } from './inscripciones.api';
import { Inscripcion } from './inscripcion.model';
import { Curso } from './curso.model';
import { Pagina } from './paginacion';
import { limpiarSesion } from '../../testing/sesion';

const CON_CURSO = {
  _id: 'i1',
  curso: { _id: 'c1', nombre: 'Álgebra', descripcion: 'Vectores' },
  estudiante: { _id: 'e1', nombre: 'Ana', correo: 'ana@x.com' },
};

describe('InscripcionesApi', () => {
  let api: InscripcionesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(InscripcionesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    limpiarSesion();
    TestBed.resetTestingModule();
  });

  const pedirLista = () => http.expectOne(r => r.url === '/api/inscripciones');
  const tituloDe = (i?: Inscripcion) => (i?.curso as Curso | undefined)?.titulo;

  describe('el listado', () => {
    it('pide el tope del backend, porque ninguna pantalla tiene paginador', () => {
      api.listInscripciones().subscribe();

      expect(pedirLista().request.params.get('limit')).toBe('100');
    });

    it('los filtros viajan cuando los hay, y no cuando no', () => {
      api.listInscripciones({ curso: 'c1', estudiante: 'e1', limite: 5 }).subscribe();
      const con = pedirLista().request.params;
      expect(con.get('curso')).toBe('c1');
      expect(con.get('estudiante')).toBe('e1');
      expect(con.get('limit')).toBe('5');

      api.listInscripciones().subscribe();
      const sin = pedirLista().request.params;
      expect(sin.has('curso')).toBeFalse();
      expect(sin.has('estudiante')).toBeFalse();
    });

    it('el curso poblado pasa por el mapper: nombre se lee como titulo', () => {
      let lista: Inscripcion[] | undefined;
      api.listInscripciones().subscribe(l => (lista = l));

      pedirLista().flush({ ok: true, inscripciones: [CON_CURSO] });

      expect(tituloDe(lista?.[0])).toBe('Álgebra');
    });

    it('si el curso llega como identificador, se deja como está', () => {
      let lista: Inscripcion[] | undefined;
      api.listInscripciones().subscribe(l => (lista = l));

      pedirLista().flush({ ok: true, inscripciones: [{ _id: 'i1', curso: 'c1' }] });

      expect(lista?.[0].curso).toBe('c1');
    });

    it('un array pelado también vale', () => {
      let lista: Inscripcion[] | undefined;
      api.listInscripciones().subscribe(l => (lista = l));

      pedirLista().flush([CON_CURSO]);

      expect(tituloDe(lista?.[0])).toBe('Álgebra');
    });

    it('sin la clave esperada, lista vacía', () => {
      let lista: Inscripcion[] | undefined;
      api.listInscripciones().subscribe(l => (lista = l));

      pedirLista().flush({ ok: true });

      expect(lista).toEqual([]);
    });

    it('el paginado conserva el total: por ahí se sabe si falta gente', () => {
      let pagina: Pagina<Inscripcion> | undefined;
      api.listInscripcionesPaginado().subscribe(p => (pagina = p));

      pedirLista().flush({ ok: true, inscripciones: [CON_CURSO], total: 140 });

      // El tope es global, no por curso: con 140 matrículas repartidas, un
      // recuento hecho sobre las 100 recibidas se queda corto y hay que poder
      // saberlo.
      expect(pagina?.total).toBe(140);
      expect(pagina?.items.length).toBe(1);
    });
  });

  describe('matricular', () => {
    it('traduce curso/estudiante a cursoId/estudianteId', () => {
      api.createInscripcion({ curso: 'c1', estudiante: 'e1' }).subscribe();

      const peticion = http.expectOne('/api/inscripciones');
      expect(peticion.request.body).toEqual({ cursoId: 'c1', estudianteId: 'e1' });
      peticion.flush({ ok: true, inscripcion: { _id: 'i1' } });
    });

    it('la respuesta vale con sobre y sin él', () => {
      let conSobre: Inscripcion | undefined;
      api.createInscripcion({ curso: 'c1', estudiante: 'e1' }).subscribe(i => (conSobre = i));
      http.expectOne('/api/inscripciones').flush({ ok: true, inscripcion: { _id: 'i1' } });
      expect(conSobre?._id).toBe('i1');

      let pelada: Inscripcion | undefined;
      api.createInscripcion({ curso: 'c1', estudiante: 'e2' }).subscribe(i => (pelada = i));
      http.expectOne('/api/inscripciones').flush({ _id: 'i2' });
      expect(pelada?._id).toBe('i2');
    });

    it('por correo manda el correo recortado, que es la vía del profesor', () => {
      api.matricularPorCorreo('c1', '  ana@x.com  ').subscribe();

      const peticion = http.expectOne('/api/inscripciones');
      // No hay desplegable de estudiantes para el profesor: `GET /api/usuarios`
      // es solo de admin y abrirlo repartiría el centro entero.
      expect(peticion.request.body).toEqual({ cursoId: 'c1', correo: 'ana@x.com' });
      peticion.flush({ ok: true, inscripcion: { _id: 'i1' } });
    });

    it('matricularse uno mismo usa el id de la sesión', () => {
      localStorage.setItem('token', 'jwt-de-prueba');
      localStorage.setItem('usuario', JSON.stringify({ _id: 'e9', rol: 'estudiante' }));

      api.enrollMe('c1').subscribe();

      const peticion = http.expectOne('/api/inscripciones');
      expect(peticion.request.body).toEqual({ cursoId: 'c1', estudianteId: 'e9' });
      peticion.flush({ ok: true, inscripcion: { _id: 'i1' } });
    });

    it('sin sesión, matricularse falla aquí y no manda una petición sin dueño', () => {
      expect(() => api.enrollMe('c1')).toThrow();

      http.expectNone('/api/inscripciones');
    });
  });

  it('darse de baja llama al recurso por su id', () => {
    let hecho = false;
    api.deleteInscripcion('i1').subscribe(() => (hecho = true));

    const peticion = http.expectOne('/api/inscripciones/i1');
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null);

    expect(hecho).toBeTrue();
  });
});
