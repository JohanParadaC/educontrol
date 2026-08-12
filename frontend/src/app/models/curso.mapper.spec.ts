import { aCurso, aCursos, deCurso } from './curso.mapper';

/**
 * El backend llama `nombre` a lo que la interfaz llama `titulo`. Antes eso
 * estaba parcheado con `?? ` en nueve sitios; ahora vive aquí, así que aquí
 * es donde se comprueba.
 */
describe('curso.mapper', () => {
  describe('aCurso (API → aplicación)', () => {
    it('traduce nombre a titulo', () => {
      expect(aCurso({ _id: '1', nombre: 'Angular', descripcion: 'd' }).titulo).toBe('Angular');
    });

    it('respeta titulo si ya viene así', () => {
      expect(aCurso({ _id: '1', titulo: 'Ya venía' }).titulo).toBe('Ya venía');
    });

    it('desenvuelve respuestas del tipo { curso: ... }', () => {
      expect(aCurso({ ok: true, curso: { _id: '9', nombre: 'Node' } }).titulo).toBe('Node');
    });

    it('no deja el título en undefined si falta el dato', () => {
      // Un undefined aquí acababa pintando celdas vacías en las tablas.
      expect(aCurso({ _id: '1' }).titulo).toBe('');
    });

    it('conserva el resto de campos', () => {
      const c = aCurso({ _id: '1', nombre: 'X', descripcion: 'desc', profesor: { nombre: 'Ana' } });
      expect(c._id).toBe('1');
      expect(c.descripcion).toBe('desc');
      expect((c.profesor as any).nombre).toBe('Ana');
    });

    it('aCursos tolera null y undefined', () => {
      expect(aCursos(null)).toEqual([]);
      expect(aCursos(undefined)).toEqual([]);
      expect(aCursos([{ nombre: 'A' }, { nombre: 'B' }]).map(c => c.titulo)).toEqual(['A', 'B']);
    });
  });

  describe('deCurso (aplicación → API)', () => {
    it('traduce titulo a nombre', () => {
      expect(deCurso({ titulo: 'Angular', descripcion: 'd' })).toEqual({ nombre: 'Angular', descripcion: 'd' });
    });

    it('omite las claves ausentes para no pisar campos en ediciones parciales', () => {
      const salida = deCurso({ descripcion: 'solo esto' });
      expect(salida).toEqual({ descripcion: 'solo esto' });
      expect('nombre' in salida).toBeFalse();
    });

    it('envía el id del profesor, no el objeto poblado', () => {
      expect(deCurso({ profesor: { _id: 'p1', nombre: 'Ana' } as any })['profesor']).toBe('p1');
      expect(deCurso({ profesor: 'p2' as any })['profesor']).toBe('p2');
    });

    it('ida y vuelta conserva el título', () => {
      const original = { _id: '1', nombre: 'Testing', descripcion: 'd' };
      expect(deCurso(aCurso(original))['nombre']).toBe('Testing');
    });
  });
});
