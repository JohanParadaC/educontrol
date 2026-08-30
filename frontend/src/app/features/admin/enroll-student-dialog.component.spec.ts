// El diálogo de matricular. Tiene dos modos y no tenía ningún test: con lista
// de estudiantes es un desplegable —lo que ve un admin— y sin ella un correo,
// que es la vía del profesor, porque `GET /api/usuarios` es solo de admin y
// abrirlo sería repartir el nombre y el correo de todo el centro.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { EnrollStudentDialogComponent, MatriculaPedida } from './enroll-student-dialog.component';

const ESTUDIANTES = [
  { _id: 'e1', nombre: 'Ana', correo: 'ana@x.com' },
  { _id: 'e2', nombre: 'Diego', correo: 'diego@x.com' },
];

describe('EnrollStudentDialogComponent', () => {
  let fixture: ComponentFixture<EnrollStudentDialogComponent>;
  let componente: EnrollStudentDialogComponent;
  let cerrado: MatriculaPedida | undefined;

  function montar(data: Record<string, unknown>) {
    cerrado = undefined;

    TestBed.configureTestingModule({
      imports: [EnrollStudentDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        {
          provide: MatDialogRef,
          useValue: { close: (v: MatriculaPedida | undefined) => (cerrado = v) },
        },
      ],
    });

    fixture = TestBed.createComponent(EnrollStudentDialogComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  describe('con lista (administración)', () => {
    it('pide elegir a alguien, y sin elección no envía', () => {
      montar({ cursoTitulo: 'Álgebra', estudiantes: ESTUDIANTES });

      expect(componente.porLista).toBeTrue();
      expect(componente.form.invalid).toBeTrue();

      componente.submit();
      expect(cerrado).toBeUndefined();
    });

    it('devuelve el id elegido, no el correo', () => {
      montar({ cursoTitulo: 'Álgebra', estudiantes: ESTUDIANTES });

      componente.form.patchValue({ estudianteId: 'e2' });
      componente.submit();

      expect(cerrado).toEqual({ estudianteId: 'e2' });
    });

    it('una lista vacía sigue siendo lista: no cae al modo correo', () => {
      // `[]` es "no hay estudiantes que matricular", no "no puedes verlos".
      montar({ cursoTitulo: 'Álgebra', estudiantes: [] });

      expect(componente.porLista).toBeTrue();
      expect(componente.form.controls.correo.valid).toBeTrue();
    });
  });

  describe('sin lista (profesor)', () => {
    it('pide un correo, y uno mal escrito no pasa', () => {
      montar({ cursoTitulo: 'Álgebra' });

      expect(componente.porLista).toBeFalse();
      expect(componente.form.invalid).toBeTrue();

      componente.form.patchValue({ correo: 'esto-no-es-un-correo' });
      expect(componente.form.invalid).toBeTrue();
      componente.submit();
      expect(cerrado).toBeUndefined();
    });

    it('con un correo válido cierra con él', () => {
      montar({ cursoTitulo: 'Álgebra' });

      componente.form.patchValue({ correo: 'ana@x.com' });
      componente.submit();

      expect(cerrado).toEqual({ correo: 'ana@x.com' });
    });

    it('un correo con espacios alrededor lo rechaza el validador, no el trim', () => {
      montar({ cursoTitulo: 'Álgebra' });

      // Queda escrito porque sorprende: `submit()` hace `.trim()`, pero
      // `Validators.email` mira el valor en crudo y no llega a ejecutarse. Un
      // correo pegado con un espacio detrás se lee como "no válido".
      componente.form.patchValue({ correo: '  ana@x.com  ' });

      expect(componente.form.invalid).toBeTrue();
      componente.submit();
      expect(cerrado).toBeUndefined();
    });

    it('el id no se exige en este modo: si no, el botón no se activaría nunca', () => {
      montar({ cursoTitulo: 'Álgebra' });

      componente.form.patchValue({ correo: 'ana@x.com' });

      expect(componente.form.valid).toBeTrue();
      expect(componente.form.value.estudianteId).toBe('');
    });
  });
});
