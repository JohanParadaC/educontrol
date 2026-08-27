// src/app/features/admin/actividad.component.ts
// ---------------------------------------------------------------------------
// El historial de acciones administrativas.
//
// Vive en su propio componente y no dentro de admin-dashboard porque ese
// fichero ya pasa de 500 líneas y esto no comparte estado con él: se pide a su
// endpoint, se pagina solo y se filtra solo.
//
// Solo lee. No hay forma de escribir ni de borrar el registro desde la
// interfaz, igual que no la hay desde la API: un historial editable no sirve
// para lo que sirve un historial.
// ---------------------------------------------------------------------------
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';

import { ApiService, LIMITE_PAGINA } from '../../core/api.service';
import { mensajeDeError } from '../../core/http-error';
import { AccionAuditada, RegistroAuditoria } from '../../data/auditoria.model';
import { EstadoVistaComponent } from '../../shared/estado-vista.component';

/** El texto que se lee en pantalla para cada acción. El backend guarda claves. */
const ETIQUETAS: Record<AccionAuditada, string> = {
  'rol.cambiado': 'Cambio de rol',
  'curso.creado': 'Curso creado',
  'curso.editado': 'Curso editado',
  'curso.borrado': 'Curso borrado',
  'matricula.creada': 'Matrícula creada',
  'matricula.borrada': 'Matrícula borrada',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-actividad',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    EstadoVistaComponent,
  ],
  templateUrl: './actividad.component.html',
  styleUrls: ['./actividad.component.scss'],
})
export class ActividadComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  readonly registros = signal<RegistroAuditoria[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly total = signal(0);

  tamPagina = LIMITE_PAGINA;
  private pagina = 1;

  readonly columnas = ['cuando', 'quien', 'accion', 'sobre'];
  readonly acciones = Object.entries(ETIQUETAS) as Array<[AccionAuditada, string]>;

  /** Vacío es "todas": el desplegable empieza sin filtro. */
  readonly accion = new FormControl<AccionAuditada | ''>('', { nonNullable: true });
  readonly buscar = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    this.cargar();

    // Cambiar de filtro vuelve a la primera página: quedarse en la 3 de un
    // listado que ahora tiene una sola página enseña un vacío que no lo es.
    this.accion.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargar(1));

    this.buscar.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargar(1));
  }

  cargar(pagina = this.pagina): void {
    this.pagina = pagina;
    this.cargando.set(true);
    this.error.set('');

    this.api
      .listAuditoria(pagina, this.tamPagina, {
        accion: this.accion.value,
        buscar: this.buscar.value,
      })
      .subscribe({
        next: p => {
          this.registros.set(p.items);
          this.total.set(p.total);
          this.cargando.set(false);
        },
        error: err => {
          this.cargando.set(false);
          // Un fallo de carga no es "no ha pasado nada": son cosas distintas y
          // aquí la diferencia importa más que en ningún otro listado.
          this.registros.set([]);
          this.error.set(mensajeDeError(err, 'No se pudo cargar la actividad.'));
        },
      });
  }

  onPagina(e: PageEvent): void {
    this.tamPagina = e.pageSize;
    this.cargar(e.pageIndex + 1);
  }

  /**
   * Fecha y hora, en corto.
   *
   * Con `Intl` y no con el `DatePipe` de Angular a propósito: el pipe arrastra
   * el motor de formato de `@angular/common` al bundle INICIAL —11 kB medidos,
   * que paga todo el mundo, incluida la portada— para una tabla que solo ve un
   * administrador. `Intl.DateTimeFormat` es del navegador y no pesa nada; el
   * formateador se crea una vez y no en cada fila.
   */
  private readonly formato = new Intl.DateTimeFormat('es', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  cuando(iso: string): string {
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? '—' : this.formato.format(fecha);
  }

  etiqueta(accion: AccionAuditada): string {
    return ETIQUETAS[accion] ?? accion;
  }

  /** Clase del distintivo: crear, editar y borrar no pesan lo mismo. */
  tono(accion: AccionAuditada): string {
    if (accion.endsWith('.borrada') || accion.endsWith('.borrado')) return 'baja';
    if (accion.endsWith('.creada') || accion.endsWith('.creado')) return 'alta';
    return 'cambio';
  }

  /**
   * Qué cambió, en una línea.
   *
   * Compara `antes` y `despues` y saca solo las claves que difieren. Sin esto
   * la fila diría "curso editado" y no qué se editó, que es justo lo que se
   * viene a mirar. Los objetos son `unknown` a propósito —cada acción compara
   * cosas distintas—, así que se comprueba antes de recorrerlos.
   */
  resumen(r: RegistroAuditoria): string {
    const antes = r.antes as Record<string, unknown> | undefined;
    const despues = r.despues as Record<string, unknown> | undefined;
    if (!esObjeto(antes) || !esObjeto(despues)) return '';

    return Object.keys(despues)
      .filter(k => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
      .slice(0, 3)
      .map(k => `${k}: ${texto(antes[k])} → ${texto(despues[k])}`)
      .join(' · ');
  }

  trackRegistro = (_: number, r: RegistroAuditoria) => r._id;
}

/** ¿Es un objeto plano por el que se pueda iterar? */
function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Un valor cualquiera, en corto y legible. */
function texto(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  return s.length > 28 ? s.slice(0, 27) + '…' : s;
}
