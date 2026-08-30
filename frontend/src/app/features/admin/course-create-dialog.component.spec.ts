// El diálogo de crear y editar cursos. No tenía ni un test, y es un formulario
// con validación condicional —el selector de profesor solo lo ve un admin—, dos
// modos (alta y edición) y una normalización de "sin cupo" que decide lo que
// recibe el backend.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { CourseCreateDialogComponent } from './course-create-dialog.component';

const PROFESORES = [
  { _id: 'p1', nombre: 'Lucía', correo: 'lucia@x.com' },
  { _id: 'p2', nombre: 'Marcos', correo: 'marcos@x.com' },
];

describe('CourseCreateDialogComponent', () => {
  let fixture: ComponentFixture<CourseCreateDialogComponent>;
  let componente: CourseCreateDialogComponent;
  let cerrado: unknown;

  function montar(data: Record<string, unknown>) {
    cerrado = undefined;

    TestBed.configureTestingModule({
      imports: [CourseCreateDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: (v: unknown) => (cerrado = v) } },
      ],
    });

    fixture = TestBed.createComponent(CourseCreateDialogComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  const rellenar = (valores: Record<string, unknown>) => {
    componente.form.patchValue(valores);
    fixture.detectChanges();
  };

  describe('alta', () => {
    it('arranca vacío, abierto y sin cupo', () => {
      montar({ soyAdmin: true, profesores: PROFESORES });

      expect(componente.form.value.titulo).toBe('');
      expect(componente.form.value.estado).toBe('abierto');
      // `null` y no 0: vacío significa "sin límite", no "no cabe nadie".
      expect(componente.form.value.cupoMaximo).toBeNull();
    });

    it('sin título o sin descripción no se envía', () => {
      montar({ soyAdmin: false, profesores: [] });

      rellenar({ titulo: '', descripcion: 'Algo' });
      componente.submit();
      expect(cerrado).toBeUndefined();

      rellenar({ titulo: 'Álgebra', descripcion: '' });
      componente.submit();
      expect(cerrado).toBeUndefined();
    });

    it('un admin tiene que elegir profesor; un profesor no', () => {
      montar({ soyAdmin: true, profesores: PROFESORES });
      rellenar({ titulo: 'Álgebra', descripcion: 'Vectores' });

      // Falta el profesor: el admin asigna, así que es obligatorio.
      expect(componente.form.invalid).toBeTrue();
      componente.submit();
      expect(cerrado).toBeUndefined();

      rellenar({ profesorId: 'p1' });
      componente.submit();
      expect(cerrado).toEqual(
        jasmine.objectContaining({ titulo: 'Álgebra', profesor: 'p1', cupoMaximo: null })
      );
    });

    it('un profesor edita el suyo y el profesor no viaja', () => {
      montar({ soyAdmin: false, profesores: [] });
      rellenar({ titulo: 'Node', descripcion: 'Express' });

      expect(componente.form.valid).toBeTrue();
      componente.submit();

      // `null` y no un id inventado: reasignar es cosa de administración, y el
      // backend tampoco se lo dejaría.
      expect(cerrado).toEqual(jasmine.objectContaining({ profesor: null }));
    });

    it('recorta los espacios de título y descripción', () => {
      montar({ soyAdmin: false, profesores: [] });
      rellenar({ titulo: '  Álgebra  ', descripcion: '  Vectores  ' });

      componente.submit();

      expect(cerrado).toEqual(
        jasmine.objectContaining({ titulo: 'Álgebra', descripcion: 'Vectores' })
      );
    });

    it('un cupo de cero o negativo no pasa el validador', () => {
      montar({ soyAdmin: false, profesores: [] });
      rellenar({ titulo: 'Álgebra', descripcion: 'Vectores', cupoMaximo: 0 });

      expect(componente.form.invalid).toBeTrue();
      componente.submit();
      expect(cerrado).toBeUndefined();
    });

    it('un campo numérico vacío sale como null, no como cadena', () => {
      montar({ soyAdmin: false, profesores: [] });
      rellenar({ titulo: 'Álgebra', descripcion: 'Vectores' });
      // Un <input type="number"> vacío da '' y no null: si eso llegara al
      // backend, "sin límite" tendría dos formas.
      componente.form.controls.cupoMaximo.setValue('' as unknown as number);

      componente.submit();

      expect((cerrado as { cupoMaximo: number | null }).cupoMaximo).toBeNull();
    });
  });

  describe('edición', () => {
    it('llega con los datos del curso puestos', () => {
      montar({
        soyAdmin: true,
        profesores: PROFESORES,
        initial: {
          titulo: 'Álgebra',
          descripcion: 'Vectores',
          profesorId: 'p2',
          cupoMaximo: 20,
          estado: 'cerrado',
        },
      });

      expect(componente.form.value).toEqual({
        titulo: 'Álgebra',
        descripcion: 'Vectores',
        profesorId: 'p2',
        cupoMaximo: 20,
        estado: 'cerrado',
      });
      expect(componente.form.valid).toBeTrue();
    });

    it('lo que no traiga el curso cae a su valor por defecto', () => {
      montar({
        soyAdmin: false,
        profesores: [],
        initial: { titulo: 'Node', descripcion: 'Express' },
      });

      expect(componente.form.value.estado).toBe('abierto');
      expect(componente.form.value.cupoMaximo).toBeNull();
    });

    it('quitar el cupo se manda como null: "sin cupo" tiene una sola forma', () => {
      montar({
        soyAdmin: false,
        profesores: [],
        initial: { titulo: 'Node', descripcion: 'Express', cupoMaximo: 30 },
      });

      componente.form.controls.cupoMaximo.setValue(null);
      componente.submit();

      expect((cerrado as { cupoMaximo: number | null }).cupoMaximo).toBeNull();
    });
  });

  it('sin lista de profesores no revienta: se queda en un array vacío', () => {
    montar({ soyAdmin: true, profesores: undefined });

    expect(componente.profesores).toEqual([]);
  });

  it('elegir profesor en el desplegable marca el campo como tocado', () => {
    montar({ soyAdmin: true, profesores: PROFESORES });

    componente.onProfesorChange({ value: 'p2' } as never);

    expect(componente.form.value.profesorId).toBe('p2');
    expect(componente.form.controls.profesorId.touched).toBeTrue();
  });

  it('el desplegable vacío deja el campo vacío, no la cadena "undefined"', () => {
    montar({ soyAdmin: true, profesores: PROFESORES });

    componente.onProfesorChange({ value: null } as never);

    expect(componente.form.value.profesorId).toBe('');
    expect(componente.form.invalid).toBeTrue();
  });
});
