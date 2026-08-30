// src/app/shared/navbar/navbar.component.ts
// ---------------------------------------------------------------------------
// El armazón de la consola: barra lateral + barra superior.
//
// Antes era una barra azul de 64 px con los enlaces en fila. El elemento con
// más peso visual de la pantalla era el que menos información lleva, y en
// escritorio se desperdiciaba todo el alto. Ahora:
//
//   ≥1024 px  lateral fija de 260 px (o 64 si se colapsa) + superior de 56 px
//   <1024 px  la lateral se convierte en cajón, con su capa de fondo, su
//             cierre con Escape y su cierre al navegar — el mismo
//             comportamiento del menú móvil de antes.
//
// El componente envuelve el contenido de la página con <ng-content>: así el
// armazón y su estado viven en un solo sitio y app.component solo compone.
// ---------------------------------------------------------------------------
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../core/auth.service';
import { rutaInicioPara } from '../../core/rutas';

/** Un destino de la navegación, con la condición para mostrarlo. */
interface Enlace {
  etiqueta: string;
  ruta: string;
  icono: string;
  visible: () => boolean;
}

/** Los enlaces se agrupan para que la lateral no sea una lista plana. */
interface Grupo {
  titulo: string;
  enlaces: Enlace[];
}

const CLAVE_COLAPSADA = 'lateral-colapsada';

/**
 * Con esta cantidad de destinos o menos, la lateral arranca colapsada.
 *
 * Tres es lo que ve un profesor —Inicio, Mis clases y Mi cuenta— repartidos en
 * tres grupos con su título cada uno: más cromo que contenido.
 */
const DESTINOS_PARA_COLAPSAR = 3;

/** Lo que eligió el usuario, o `null` si nunca tocó el botón. */
function eleccionGuardada(): boolean | null {
  const guardado = localStorage.getItem(CLAVE_COLAPSADA);
  if (guardado === 'si') return true;
  if (guardado === 'no') return false;
  return null;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  imports: [
    RouterModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  /** Cajón abierto en móvil. En escritorio no se usa. */
  readonly menuAbierto = signal(false);

  /**
   * Si hay sitio para la lateral al lado del contenido.
   *
   * Se pregunta a matchMedia en vez de deducirlo del CSS porque el estado
   * "cajón cerrado" tiene que ser UNA clase y no dos reglas compitiendo dentro
   * de una media query: con la encapsulación de Angular por medio, fiarse de
   * cuál gana es cómo el cajón se quedaba invisible al abrirlo.
   */
  private readonly consulta = matchMedia('(min-width: 1024px)');
  readonly esEscritorio = signal(this.consulta.matches);

  /** Fuera de la pantalla y sin poder recibir el foco. */
  readonly cajonCerrado = computed(() => !this.esEscritorio() && !this.menuAbierto());

  /**
   * La elección explícita sobre la lateral, si alguien ha tocado el botón.
   *
   * `null` significa "nadie ha dicho nada todavía", que no es lo mismo que
   * "expandida": sin esa distinción no se puede tener un valor por defecto que
   * dependa del rol y a la vez respetar a quien lo cambia.
   */
  private readonly eleccion = signal<boolean | null>(eleccionGuardada());

  /**
   * Lateral colapsada a 64 px.
   *
   * Por defecto va colapsada cuando el rol tiene tres destinos o menos: 260 px
   * de ancho y casi todo el alto vacío para enseñar dos enlaces y uno es un
   * cuarto de pantalla pagado por nada. Con más destinos arranca abierta, que
   * es cuando la lista se lee como una lista.
   *
   * Y si alguien la abre o la cierra a mano, gana su elección y se recuerda
   * entre visitas: es una preferencia de quien mira, y perderla en cada recarga
   * molesta más que ayuda.
   */
  readonly colapsada = computed(
    () => this.eleccion() ?? this.planos().length <= DESTINOS_PARA_COLAPSAR
  );

  /** Ruta actual, para marcar la sección activa y titular la barra superior. */
  private readonly url = signal(this.router.url);

  readonly role = this.auth.rol;
  readonly isLoggedIn = this.auth.estaAutenticado;

  /** Texto del buscador de la barra superior. */
  termino = '';

  private readonly principal: Enlace[] = [
    {
      etiqueta: 'Inicio',
      ruta: '/dashboard',
      icono: 'dashboard',
      visible: () => this.isLoggedIn() && this.role() !== 'profesor',
    },
    {
      etiqueta: 'Inicio',
      ruta: '/profesor/dashboard',
      icono: 'dashboard',
      visible: () => this.isLoggedIn() && this.role() === 'profesor',
    },
    {
      etiqueta: 'Catálogo',
      ruta: '/cursos',
      icono: 'school',
      visible: () => this.isLoggedIn() && this.role() === 'estudiante',
    },
    {
      etiqueta: 'Mis cursos',
      ruta: '/mis-cursos',
      icono: 'bookmark',
      visible: () => this.isLoggedIn() && this.role() === 'estudiante',
    },
    {
      etiqueta: 'Mis clases',
      ruta: '/profesor/clases',
      icono: 'groups',
      visible: () => this.isLoggedIn() && this.role() === 'profesor',
    },
    {
      etiqueta: 'Administración',
      ruta: '/admin',
      icono: 'admin_panel_settings',
      visible: () => this.isLoggedIn() && this.role() === 'admin',
    },
  ];

  private readonly cuenta: Enlace[] = [
    {
      etiqueta: 'Mi cuenta',
      ruta: '/cuenta',
      icono: 'account_circle',
      visible: () => this.isLoggedIn(),
    },
  ];

  /** Para quien no ha entrado: la navegación es entrar o registrarse. */
  private readonly invitado: Enlace[] = [
    { etiqueta: 'Entrar', ruta: '/login', icono: 'login', visible: () => !this.isLoggedIn() },
    {
      etiqueta: 'Crear cuenta',
      ruta: '/register',
      icono: 'person_add',
      visible: () => !this.isLoggedIn(),
    },
  ];

  /**
   * Los grupos que tocan a este rol, ya filtrados.
   *
   * Es `computed` y no un getter: con OnPush, un getter se reevaluaría solo
   * cuando algo más marcase la vista, y al iniciar sesión la navegación se
   * quedaría con los enlaces de invitado hasta el siguiente clic.
   */
  readonly grupos = computed<Grupo[]>(() => {
    this.auth.usuario();
    const visibles = (lista: Enlace[]) => lista.filter(e => e.visible());
    return [
      { titulo: 'Principal', enlaces: visibles(this.principal) },
      { titulo: 'Cuenta', enlaces: visibles(this.cuenta) },
      { titulo: 'Acceso', enlaces: visibles(this.invitado) },
    ].filter(g => g.enlaces.length);
  });

  /** Todos los enlaces visibles en plano, para titular la barra superior. */
  private readonly planos = computed(() => this.grupos().flatMap(g => g.enlaces));

  /** Título que la propia ruta declara en su `data`, si lo hace. */
  private readonly tituloDeRuta = signal(this.tituloDeclarado());

  /**
   * Título de la sección actual.
   *
   * Sale de la misma lista que la navegación, así que no pueden
   * desincronizarse. La excepción son las pantallas que no son un destino del
   * menú —la ficha de un curso—: esas se nombran a sí mismas con `data.titulo`,
   * porque si no la barra decía "EduControl" en una página que sí sabe qué es.
   */
  readonly titulo = computed(() => {
    const declarado = this.tituloDeRuta();
    if (declarado) return declarado;

    const actual = this.url();
    const enlace = this.planos()
      .filter(e => actual.startsWith(e.ruta))
      .sort((a, b) => b.ruta.length - a.ruta.length)[0];
    return enlace?.etiqueta ?? 'EduControl';
  });

  /** Baja hasta la ruta activa más profunda y lee su `data.titulo`. */
  private tituloDeclarado(): string {
    let ruta = this.router.routerState.root;
    while (ruta.firstChild) ruta = ruta.firstChild;
    return (ruta.snapshot.data?.['titulo'] as string) ?? '';
  }

  /** Ruta de la marca: sin sesión, la portada; con sesión, tu panel. */
  readonly rutaInicio = computed(() => (this.isLoggedIn() ? rutaInicioPara(this.role()) : '/'));

  /** Iniciales para el avatar. Dos palabras como mucho. */
  readonly iniciales = computed(() => {
    const nombre = this.auth.usuario()?.nombre ?? '';
    return (
      nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(p => p[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  });

  /** Clase del chip de rol: el color es siempre el mismo para el mismo rol. */
  readonly claseRol = computed(() => {
    const r = this.role();
    return r === 'admin' ? 'admin' : r === 'profesor' ? 'pro' : '';
  });

  constructor() {
    this.consulta.addEventListener('change', e => this.esEscritorio.set(e.matches));

    this.router.events
      .pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(e => {
        this.url.set((e as NavigationEnd).urlAfterRedirects);
        this.tituloDeRuta.set(this.tituloDeclarado());
        // Navegar cierra el cajón: si no, al elegir una opción se queda abierto
        // tapando la página a la que acabas de llegar.
        this.menuAbierto.set(false);
      });
  }

  /** ¿Es esta la sección en la que estamos? */
  esActiva(ruta: string): boolean {
    return this.url().startsWith(ruta);
  }

  alternarMenu(): void {
    this.menuAbierto.update(abierto => !abierto);
  }

  alternarColapso(): void {
    const siguiente = !this.colapsada();
    localStorage.setItem(CLAVE_COLAPSADA, siguiente ? 'si' : 'no');
    this.eleccion.set(siguiente);
  }

  /** Escape cierra el cajón, como se espera de cualquier panel desplegable. */
  @HostListener('document:keydown.escape')
  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  /** El buscador de la barra superior lleva al catálogo con el término puesto. */
  buscar(): void {
    const q = this.termino.trim();
    this.router.navigate(['/cursos'], { queryParams: q ? { buscar: q } : {} });
  }

  logout(): void {
    this.menuAbierto.set(false);
    try {
      this.auth.logout();
    } finally {
      this.router.navigateByUrl('/login');
    }
  }
}
