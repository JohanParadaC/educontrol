import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../shared/material.module';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';

interface CursoLite { _id: string; titulo?: string; nombre?: string; descripcion?: string; profesor?: any; }
interface InscripcionLite {
  _id: string;
  curso?: string | { _id: string; titulo?: string; nombre?: string };
  estudiante?: string | { _id: string };
  estado?: string;
  progreso?: number;
}

@Component({
  standalone: true,
  selector: 'app-mis-cursos',
  templateUrl: './mis-cursos.component.html',
  styleUrls: ['./mis-cursos.component.scss'],
  imports: [CommonModule, MaterialModule]
})
export class MisCursosComponent implements OnInit {
  misInscripciones: InscripcionLite[] = [];
  cursosMap = new Map<string, CursoLite>();
  loading = false;

  constructor(
    private api: ApiService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    const userId = this.auth.usuario?._id;
    if (!userId) return;

    this.loading = true;

    // Mis inscripciones + cursos, vía ApiService (mapea estructuras del backend)
    Promise.all([
      this.api.listCursos().toPromise().then(cs => cs || []),
      this.api.listInscripcionesMe().toPromise().then(i => i || [])
    ])
    .then(([cursos, inscripciones]) => {
      cursos.forEach(c => this.cursosMap.set((c as any)._id, c as any));
      this.misInscripciones = inscripciones;
    })
    .finally(() => this.loading = false);
  }

  nombreCurso(i: InscripcionLite): string {
    if (i.curso && typeof i.curso !== 'string') {
      return i.curso.titulo || i.curso.nombre || '(sin nombre)';
    }
    const c = this.cursosMap.get(i.curso as string);
    return (c?.titulo || c?.nombre || '(curso)');
  }
}