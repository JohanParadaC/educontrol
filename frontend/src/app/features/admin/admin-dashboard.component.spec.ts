// El panel de administración es el componente más grande del frontend y hasta
// ahora no tenía un solo test. Aquí se fijan las decisiones que se pueden
// romper sin que nada cante:
//
//  · las dos tablas tienen estado SEPARADO: que falle una no vacía la otra;
//  · un error de carga se queda en pantalla y NO se convierte en "no hay
//    usuarios", que es justo lo que app-estado-vista viene a evitar;
//  · los cambios de rol se acumulan y se guardan a la vez, y si una de las
//    peticiones falla las demás siguen;
//  · los dos paginadores son independientes.
//
// Se prueba con HttpTestingController y no con espías sobre ApiService: lo que
// interesa es qué se pide y qué se hace con la respuesta, incluido el mapeo
// nombre↔titulo del camino real.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { AdminDashboardComponent } from './admin-dashboard.component';

/** Respuesta paginada del backend, con la clave que toque. */
const pagina = (clave: string, items: unknown[], total = items.length) => ({
  ok: true,
  [clave]: items,
  total,
  pagina: 1,
  limite: 20,
  paginas: Math.max(1, Math.ceil(total / 20)),
});

const USUARIOS = [
  { id: 'u1', nombre: 'Ana Torres', correo: 'ana@x.com', rol: 'estudiante' },
  { id: 'u2', nombre: 'Lucía Fernández', correo: 'lucia@x.com', rol: 'profesor' },
  { id: 'u3', nombre: 'Jefa', correo: 'jefa@x.com', rol: 'admin' },
];

const CURSOS = [
  {
    _id: 'c1',
    nombre: 'Álgebra',
    descripcion: 'Vectores',
    profesor: { _id: 'u2', nombre: 'Lucía Fernández' },
  },
  {
    _id: 'c2',
    nombre: 'Node.js',
    descripcion: 'Express',
    profesor: { _id: 'u2', nombre: 'Lucía Fernández' },
  },
];

describe('AdminDashboardComponent', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let componente: AdminDashboardComponent;
  let http: HttpTestingController;
  let dialogo: { open: jasmine.Spy };
  let cerrarCon: unknown;

  /** La tabla de usuarios: la paginada, no la del desplegable de profesores. */
  const pidenUsuarios = () =>
    http.expectOne(
      r => r.url === '/api/usuarios' && !r.params.get('rol') && r.params.get('limit') === '20'
    );
  const pidenCursos = () =>
    http.expectOne(r => r.url === '/api/cursos' && r.params.get('limit') === '20');

  /**
   * Las dos listas que llenan los desplegables. No son el objeto de estos
   * tests, pero salen con CADA `cargarTodo()` y hay que responderlas o
   * `verify()` protesta.
   */
  function responderOpciones() {
    http
      .expectOne(r => r.url === '/api/usuarios' && r.params.get('rol') === 'profesor')
      .flush(pagina('usuarios', []));
    http
      .expectOne(r => r.url === '/api/cursos' && r.params.get('limit') === '100')
      .flush(pagina('cursos', []));
  }

  /** Todo lo que sale al montar el panel por primera vez: las opciones y el
      historial de la sección de actividad, que solo se pide UNA vez —recargar
      las tablas no lo vuelve a pedir—. */
  function responderElResto() {
    responderOpciones();
    http.expectOne(r => r.url === '/api/auditoria').flush(pagina('registros', []));
  }

  beforeEach(() => {
    cerrarCon = true;
    dialogo = {
      open: jasmine.createSpy('open').and.callFake(() => ({ afterClosed: () => of(cerrarCon) })),
    };

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: dialogo },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminDashboardComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges(); // dispara ngOnInit -> cargarTodo()
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  describe('carga de las dos tablas', () => {
    it('pide cada tabla por separado y pinta las dos', () => {
      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush(pagina('cursos', CURSOS));
      responderElResto();
      fixture.detectChanges();

      expect(componente.usuarios().length).toBe(3);
      expect(componente.cursos().length).toBe(2);
      // El backend llama `nombre` a lo que la interfaz llama `titulo`, y esa
      // traducción tiene que haber pasado por el mapper.
      expect(componente.cursos()[0].titulo).toBe('Álgebra');
      expect(texto()).toContain('Ana Torres');
      expect(texto()).toContain('Álgebra');
    });

    it('que falle la de usuarios NO vacía la de cursos', () => {
      pidenUsuarios().flush({ ok: false }, { status: 500, statusText: 'Server Error' });
      pidenCursos().flush(pagina('cursos', CURSOS));
      responderElResto();
      fixture.detectChanges();

      expect(componente.errorUsuarios()).toBeTruthy();
      expect(componente.usuarios()).toEqual([]);
      // Lo que se fija aquí: el estado es de cada tabla, no compartido.
      expect(componente.errorCursos()).toBe('');
      expect(componente.cursos().length).toBe(2);
      expect(texto()).toContain('Álgebra');
    });

    it('y al revés: que falle la de cursos no vacía la de usuarios', () => {
      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush({ ok: false }, { status: 500, statusText: 'Server Error' });
      responderElResto();
      fixture.detectChanges();

      expect(componente.errorCursos()).toBeTruthy();
      expect(componente.errorUsuarios()).toBe('');
      expect(componente.usuarios().length).toBe(3);
      expect(texto()).toContain('Ana Torres');
    });

    it('un error de carga se queda en pantalla y no se lee como "no hay usuarios"', () => {
      pidenUsuarios().flush({ ok: false }, { status: 0, statusText: 'Unknown Error' });
      pidenCursos().flush(pagina('cursos', []));
      responderElResto();
      fixture.detectChanges();

      // Un fallo de red no dice "credenciales" ni deja la tabla muda.
      expect(componente.errorUsuarios()).toContain('No se pudo conectar');
      expect(texto()).toContain('No se pudo conectar');
      expect(componente.cargandoUsuarios()).toBeFalse();
    });
  });

  describe('paginación', () => {
    beforeEach(() => {
      pidenUsuarios().flush(pagina('usuarios', USUARIOS, 45));
      pidenCursos().flush(pagina('cursos', CURSOS, 8));
      responderElResto();
    });

    it('cambiar de página en usuarios no vuelve a pedir los cursos', () => {
      componente.onPaginaUsuarios({ pageIndex: 2, pageSize: 20, length: 45 } as never);

      const req = pidenUsuarios();
      expect(req.request.params.get('page')).toBe('3');
      req.flush(pagina('usuarios', [USUARIOS[0]], 45));

      // Las dos tablas son independientes: nadie ha tocado la de cursos.
      http.expectNone(r => r.url === '/api/cursos');
      expect(componente.pagUsuarios()).toBe(3);
      expect(componente.pagCursos()).toBe(1);
    });

    it('y al revés', () => {
      componente.onPaginaCursos({ pageIndex: 1, pageSize: 20, length: 8 } as never);

      const req = pidenCursos();
      expect(req.request.params.get('page')).toBe('2');
      req.flush(pagina('cursos', [CURSOS[0]], 8));

      http.expectNone(r => r.url === '/api/usuarios' && !r.params.get('rol'));
      expect(componente.pagCursos()).toBe(2);
      expect(componente.pagUsuarios()).toBe(1);
    });

    it('el tamaño de página elegido viaja en la siguiente petición', () => {
      componente.onPaginaUsuarios({ pageIndex: 0, pageSize: 50, length: 45 } as never);

      const req = http.expectOne(r => r.url === '/api/usuarios' && r.params.get('limit') === '50');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pagina('usuarios', USUARIOS, 45));
    });
  });

  describe('cambios de rol en lote', () => {
    beforeEach(() => {
      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush(pagina('cursos', []));
      responderElResto();
    });

    it('acumula sin guardar y el chip enseña ya el rol nuevo', () => {
      componente.onRolChange(USUARIOS[0] as never, 'profesor' as never);

      expect(componente.totalPendientes).toBe(1);
      expect(componente.rolMostrado(USUARIOS[0] as never)).toBe('profesor');
      expect(componente.tieneCambio(USUARIOS[0] as never)).toBeTrue();
      // Nada ha salido a la red todavía.
      http.expectNone(r => r.method === 'PUT');
    });

    it('volver al rol original cancela el cambio', () => {
      componente.onRolChange(USUARIOS[0] as never, 'profesor' as never);
      componente.onRolChange(USUARIOS[0] as never, 'estudiante' as never);

      expect(componente.totalPendientes).toBe(0);
      expect(componente.tieneCambio(USUARIOS[0] as never)).toBeFalse();
    });

    it('guardar manda un PUT por cambio y recarga al terminar', () => {
      componente.onRolChange(USUARIOS[0] as never, 'profesor' as never);
      componente.onRolChange(USUARIOS[1] as never, 'estudiante' as never);

      componente.guardarTodos();
      expect(componente.savingBulk()).toBeTrue();

      const puts = http.match(r => r.method === 'PUT');
      expect(puts.length).toBe(2);
      expect(puts.map(p => p.request.body.rol).sort()).toEqual(['estudiante', 'profesor']);
      puts.forEach(p => p.flush({ ok: true }));

      expect(componente.savingBulk()).toBeFalse();
      expect(componente.totalPendientes).toBe(0);

      // Y se recarga todo, que es lo que deja la tabla diciendo la verdad.
      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush(pagina('cursos', []));
      responderOpciones();
    });

    it('si una de las peticiones falla, las demás siguen y el lote termina', () => {
      componente.onRolChange(USUARIOS[0] as never, 'profesor' as never);
      componente.onRolChange(USUARIOS[1] as never, 'estudiante' as never);

      componente.guardarTodos();

      const puts = http.match(r => r.method === 'PUT');
      puts[0].flush({ ok: false }, { status: 500, statusText: 'Server Error' });
      puts[1].flush({ ok: true });

      // El forkJoin no se corta: se emite igual y se sueltan los pendientes.
      expect(componente.savingBulk()).toBeFalse();
      expect(componente.totalPendientes).toBe(0);

      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush(pagina('cursos', []));
      responderOpciones();
    });

    it('sin cambios pendientes, guardar no manda nada', () => {
      componente.guardarTodos();

      expect(componente.savingBulk()).toBeFalse();
      http.expectNone(r => r.method === 'PUT');
    });

    it('la selección múltiple apunta el rol pero no lo guarda', () => {
      componente.alternarTodos();
      // El admin no se toca desde esta tabla: quedan dos de los tres.
      expect(componente.seleccionados().size).toBe(2);

      componente.asignarRolALaSeleccion('profesor' as never);

      // Uno, no dos: Lucía YA era profesora, y ponerle el rol que ya tiene no
      // es un cambio. Es la misma regla que cancela un cambio suelto al volver
      // al rol original, y evita mandar un PUT que no cambia nada.
      expect(componente.totalPendientes).toBe(1);
      expect(componente.tieneCambio(USUARIOS[0] as never)).toBeTrue();
      expect(componente.tieneCambio(USUARIOS[1] as never)).toBeFalse();
      expect(componente.seleccionados().size).toBe(0);
      http.expectNone(r => r.method === 'PUT');
    });
  });

  describe('crear y editar cursos', () => {
    beforeEach(() => {
      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush(pagina('cursos', CURSOS));
      responderElResto();
    });

    it('crear con los datos del diálogo manda el alta y recarga', () => {
      cerrarCon = {
        titulo: 'Álgebra II',
        descripcion: 'Matrices',
        profesor: 'u2',
        cupoMaximo: 20,
        estado: 'abierto',
      };

      componente.abrirDialogNuevoCurso();

      const alta = http.expectOne(r => r.url === '/api/cursos' && r.method === 'POST');
      expect(alta.request.body).toEqual({
        nombre: 'Álgebra II',
        descripcion: 'Matrices',
        cupoMaximo: 20,
        estado: 'abierto',
        profesor: 'u2',
      });
      alta.flush({ ok: true, curso: { _id: 'c3', nombre: 'Álgebra II' } });

      // Recarga: el alta la decide el servidor y aquí no se adivina la tabla.
      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush(pagina('cursos', CURSOS));
      responderOpciones();
    });

    it('cerrar el diálogo sin guardar no manda nada', () => {
      cerrarCon = undefined;

      componente.abrirDialogNuevoCurso();

      http.expectNone(r => r.method === 'POST');
    });

    it('sin profesor no se crea: el curso quedaría sin dueño', () => {
      cerrarCon = { titulo: 'Álgebra II', descripcion: 'Matrices', profesor: '' };

      componente.abrirDialogNuevoCurso();

      http.expectNone(r => r.method === 'POST');
    });

    it('editar manda solo el curso tocado y recarga', () => {
      cerrarCon = {
        titulo: 'Álgebra revisada',
        descripcion: 'Vectores',
        profesor: 'u2',
        cupoMaximo: null,
        estado: 'cerrado',
      };

      componente.abrirDialogEditarCurso(componente.cursos()[0]);

      const edicion = http.expectOne(r => r.url === '/api/cursos/c1' && r.method === 'PUT');
      expect(edicion.request.body.nombre).toBe('Álgebra revisada');
      // `null` viaja tal cual: es como se quita el límite de plazas.
      expect(edicion.request.body.cupoMaximo).toBeNull();
      edicion.flush({ ok: true, curso: { _id: 'c1', nombre: 'Álgebra revisada' } });

      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush(pagina('cursos', CURSOS));
      responderOpciones();
    });

    it('cancelar la edición no manda nada', () => {
      cerrarCon = undefined;

      componente.abrirDialogEditarCurso(componente.cursos()[0]);

      http.expectNone(r => r.method === 'PUT');
    });
  });

  describe('matricular desde el panel', () => {
    beforeEach(() => {
      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush(pagina('cursos', CURSOS));
      responderElResto();
    });

    it('la lista de estudiantes se pide al abrir, no al cargar la página', () => {
      cerrarCon = { estudianteId: 'u1' };

      componente.abrirDialogMatricular(componente.cursos()[0]);

      // Cien usuarios que la mayoría de las visitas no llega a usar no se piden
      // al entrar: se piden cuando hacen falta.
      const opciones = http.expectOne(
        r => r.url === '/api/usuarios' && r.params.get('rol') === 'estudiante'
      );
      opciones.flush(pagina('usuarios', [USUARIOS[0]]));

      const alta = http.expectOne(r => r.url === '/api/inscripciones' && r.method === 'POST');
      expect(alta.request.body).toEqual({ cursoId: 'c1', estudianteId: 'u1' });
      alta.flush({ ok: true, inscripcion: { _id: 'i1' } });
    });

    it('la segunda vez no la vuelve a pedir', () => {
      cerrarCon = { estudianteId: 'u1' };

      componente.abrirDialogMatricular(componente.cursos()[0]);
      http
        .expectOne(r => r.url === '/api/usuarios' && r.params.get('rol') === 'estudiante')
        .flush(pagina('usuarios', [USUARIOS[0]]));
      http.expectOne(r => r.url === '/api/inscripciones').flush({ ok: true });

      componente.abrirDialogMatricular(componente.cursos()[1]);

      http.expectNone(r => r.url === '/api/usuarios' && r.params.get('rol') === 'estudiante');
      http.expectOne(r => r.url === '/api/inscripciones').flush({ ok: true });
    });

    it('cerrar sin elegir a nadie no matricula', () => {
      cerrarCon = undefined;

      componente.abrirDialogMatricular(componente.cursos()[0]);
      http
        .expectOne(r => r.url === '/api/usuarios' && r.params.get('rol') === 'estudiante')
        .flush(pagina('usuarios', []));

      http.expectNone(r => r.url === '/api/inscripciones');
    });
  });

  describe('asignar profesor (acción rápida)', () => {
    beforeEach(() => {
      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush(pagina('cursos', CURSOS));
      responderElResto();
    });

    it('sin curso o sin profesor no sale a la red', () => {
      componente.asignarProfesor();

      http.expectNone(r => r.method === 'PUT');
      expect(componente.isAssigning()).toBeFalse();
    });

    it('con los dos elegidos asigna y recarga', () => {
      componente.onCursoSel({ value: 'c1' } as never);
      componente.onProfesorSel({ value: 'u2' } as never);

      componente.asignarProfesor();

      const req = http.expectOne(r => r.url === '/api/cursos/c1' && r.method === 'PUT');
      expect(req.request.body).toEqual({ profesor: 'u2' });
      req.flush({ ok: true, curso: CURSOS[0] });

      expect(componente.isAssigning()).toBeFalse();
      pidenUsuarios().flush(pagina('usuarios', USUARIOS));
      pidenCursos().flush(pagina('cursos', CURSOS));
      responderOpciones();
    });

    it('si el servidor lo rechaza, se suelta el bloqueo y se puede reintentar', () => {
      componente.onCursoSel({ value: 'c1' } as never);
      componente.onProfesorSel({ value: 'u2' } as never);

      componente.asignarProfesor();
      http
        .expectOne(r => r.url === '/api/cursos/c1')
        .flush({ ok: false, msg: 'No se pudo' }, { status: 409, statusText: 'Conflict' });

      expect(componente.isAssigning()).toBeFalse();
    });
  });

  describe('eliminar un curso', () => {
    beforeEach(() => {
      pidenUsuarios().flush(pagina('usuarios', []));
      pidenCursos().flush(pagina('cursos', CURSOS));
      responderElResto();
    });

    it('confirmar borra y lo quita de la tabla', () => {
      cerrarCon = true;

      componente.eliminarCurso(componente.cursos()[0]);

      expect(dialogo.open).toHaveBeenCalled();
      const req = http.expectOne('/api/cursos/c1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ ok: true });

      expect(componente.cursos().map(c => c._id)).toEqual(['c2']);
      expect(componente.eliminandoId).toBeNull();
    });

    it('cancelar no borra nada', () => {
      cerrarCon = false;

      componente.eliminarCurso(componente.cursos()[0]);

      expect(dialogo.open).toHaveBeenCalled();
      http.expectNone(r => r.method === 'DELETE');
      expect(componente.cursos().length).toBe(2);
    });

    it('si el borrado falla, el curso sigue en la tabla', () => {
      cerrarCon = true;

      componente.eliminarCurso(componente.cursos()[0]);
      http
        .expectOne('/api/cursos/c1')
        .flush(
          { ok: false, msg: 'Este curso no es tuyo' },
          { status: 403, statusText: 'Forbidden' }
        );

      // Nada de quitarlo "por si acaso": si el servidor dijo que no, sigue ahí.
      expect(componente.cursos().length).toBe(2);
      expect(componente.eliminandoId).toBeNull();
    });
  });
});
