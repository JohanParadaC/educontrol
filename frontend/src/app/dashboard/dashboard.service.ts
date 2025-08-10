import { Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';

import { ApiService } from '../core/api.service';        // 👈 sube 1
import { Usuario } from '../models/usuario.model';       // 👈 sube 1
import { Curso } from '../models/curso.model';
import { Inscripcion } from '../models/inscripcion.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private api: ApiService) {}

  getUsuarios(): Observable<Usuario[]> {
    return this.api.getUsuarios();
  }
  getCursos(): Observable<Curso[]> {
    return this.api.getCursos();
  }
  getInscripciones(): Observable<Inscripcion[]> {
    return this.api.getInscripciones();
  }

  getAllData(): Observable<{
    usuarios: Usuario[];
    cursos: Curso[];
    inscripciones: Inscripcion[];
  }> {
    return forkJoin({
      usuarios: this.getUsuarios(),
      cursos: this.getCursos(),
      inscripciones: this.getInscripciones()
    });
  }
}