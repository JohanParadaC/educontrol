// La navegación: qué destinos ve cada rol, cuándo arranca colapsada la lateral,
// y el cajón de móvil —que se abre, se cierra con Escape y se cierra solo al
// navegar, porque si no tapa la página a la que acabas de llegar—.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NavbarComponent } from './navbar.component';
import {
  SesionDePrueba,
  limpiarSesion,
  responderRenovacion,
  sembrarSesion,
} from '../../../testing/sesion';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let componente: NavbarComponent;
  let http: HttpTestingController;
  let router: Router;

  /** Levanta el componente con la sesión ya sembrada (o sin ninguna). */
  function crear(sesion?: SesionDePrueba) {
    TestBed.configureTestingModule({
      imports: [
        NavbarComponent,
        NoopAnimationsModule,
        // Una ruta de destino de verdad: sin ella el router no puede navegar y
        // no se puede comprobar que el cajón se cierre al llegar.
        RouterTestingModule.withRoutes([{ path: 'cursos', children: [] }]),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(NavbarComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    if (sesion) responderRenovacion(http, sesion);
    fixture.detectChanges();
  }

  /** Monta la barra con la sesión que pida el test (o sin ninguna). */
  function montar(sesion?: SesionDePrueba) {
    limpiarSesion();
    if (sesion) sembrarSesion(sesion);
    crear(sesion);
  }

  afterEach(() => {
    http.verify();
    limpiarSesion();
    TestBed.resetTestingModule();
  });

  const destinos = () => componente.grupos().flatMap(g => g.enlaces.map(e => e.etiqueta));
  const titulos = () => componente.grupos().map(g => g.titulo);

  describe('qué ve cada rol', () => {
    it('sin sesión, la navegación es entrar o registrarse', () => {
      montar();

      expect(titulos()).toEqual(['Acceso']);
      expect(destinos()).toEqual(['Entrar', 'Crear cuenta']);
      // Ni rastro del panel de nadie.
      expect(destinos()).not.toContain('Administración');
    });

    it('un estudiante ve su catálogo y sus cursos, no el panel', () => {
      montar({ id: 'e1', rol: 'estudiante' });

      expect(destinos()).toEqual(['Inicio', 'Catálogo', 'Mis cursos', 'Mi cuenta']);
      expect(destinos()).not.toContain('Administración');
      expect(destinos()).not.toContain('Mis clases');
    });

    it('un profesor ve sus clases, y su inicio es el suyo', () => {
      montar({ id: 'p1', rol: 'profesor' });

      expect(destinos()).toEqual(['Inicio', 'Mis clases', 'Mi cuenta']);
      expect(componente.rutaInicio()).toBe('/profesor/dashboard');
    });

    it('un admin ve Administración', () => {
      montar({ id: 'a1', rol: 'admin' });

      expect(destinos()).toEqual(['Inicio', 'Administración', 'Mi cuenta']);
    });
  });

  describe('la lateral', () => {
    it('con tres destinos o menos arranca colapsada', () => {
      montar({ id: 'p1', rol: 'profesor' });

      // 260 px de ancho y casi todo el alto vacío para enseñar dos enlaces y
      // uno es un cuarto de pantalla pagado por nada.
      expect(destinos().length).toBe(3);
      expect(componente.colapsada()).toBeTrue();
    });

    it('con más destinos arranca abierta', () => {
      montar({ id: 'e1', rol: 'estudiante' });

      expect(destinos().length).toBe(4);
      expect(componente.colapsada()).toBeFalse();
    });

    it('si el usuario la abre, gana su elección sobre el valor por defecto', () => {
      montar({ id: 'p1', rol: 'profesor' });
      expect(componente.colapsada()).toBeTrue();

      componente.alternarColapso();

      expect(componente.colapsada()).toBeFalse();
      expect(localStorage.getItem('lateral-colapsada')).toBe('no');
    });

    it('cerrarla a mano también se recuerda', () => {
      montar({ id: 'e1', rol: 'estudiante' });
      expect(componente.colapsada()).toBeFalse();

      componente.alternarColapso();

      expect(componente.colapsada()).toBeTrue();
      expect(localStorage.getItem('lateral-colapsada')).toBe('si');
    });

    it('en la siguiente visita manda lo que eligió, no el valor por rol', () => {
      // Un profesor que la abrió: sus tres destinos la colapsarían por defecto.
      const profesor: SesionDePrueba = { id: 'p1', rol: 'profesor' };
      sembrarSesion(profesor);
      localStorage.setItem('lateral-colapsada', 'no');

      crear(profesor);

      expect(componente.colapsada()).toBeFalse();
    });
  });

  describe('el cajón de móvil', () => {
    it('se abre y se cierra con el mismo botón', () => {
      montar({ id: 'e1', rol: 'estudiante' });

      componente.alternarMenu();
      expect(componente.menuAbierto()).toBeTrue();

      componente.alternarMenu();
      expect(componente.menuAbierto()).toBeFalse();
    });

    it('Escape lo cierra, como cualquier panel desplegable', () => {
      montar({ id: 'e1', rol: 'estudiante' });
      componente.alternarMenu();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(componente.menuAbierto()).toBeFalse();
    });

    it('navegar lo cierra: si no, tapa la página a la que acabas de llegar', async () => {
      montar({ id: 'e1', rol: 'estudiante' });
      componente.alternarMenu();
      expect(componente.menuAbierto()).toBeTrue();

      await router.navigateByUrl('/cursos');
      fixture.detectChanges();

      expect(componente.menuAbierto()).toBeFalse();
      expect(componente.esActiva('/cursos')).toBeTrue();
    });
  });

  describe('el buscador', () => {
    it('lleva al catálogo con el término puesto', () => {
      montar({ id: 'e1', rol: 'estudiante' });
      const ir = spyOn(router, 'navigate');

      componente.termino = '  álgebra  ';
      componente.buscar();

      expect(ir).toHaveBeenCalledWith(['/cursos'], { queryParams: { buscar: 'álgebra' } });
    });

    it('vacío lleva al catálogo sin filtro, no con uno en blanco', () => {
      montar({ id: 'e1', rol: 'estudiante' });
      const ir = spyOn(router, 'navigate');

      componente.termino = '   ';
      componente.buscar();

      expect(ir).toHaveBeenCalledWith(['/cursos'], { queryParams: {} });
    });
  });

  it('las iniciales del avatar salen del nombre, dos como mucho', () => {
    montar({ id: 'e1', rol: 'estudiante', nombre: 'Ana María Torres' });

    expect(componente.iniciales()).toBe('AM');
  });
});
