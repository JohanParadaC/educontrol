import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MaterialModule } from '../shared/material.module';
import { AuthService } from '../core/auth.service';

interface Curso {
  _id: string;
  nombre: string;
  descripcion?: string;
  profesor?: any; // puede venir como id o como objeto
}

@Component({
  standalone: true,
  selector: 'app-cursos',
  templateUrl: './cursos.component.html',
  styleUrls: ['./cursos.component.scss'],
  imports: [CommonModule, HttpClientModule, MaterialModule]
})
export class CursosComponent implements OnInit {
  cursos: Curso[] = [];
  loading = false;

  constructor(
    private http: HttpClient,
    private snack: MatSnackBar,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.http.get<Curso[]>('/api/cursos').subscribe({
      next: (res) => { this.cursos = res || []; this.loading = false; },
      error: () => { this.snack.open('Error cargando cursos', 'Cerrar', { duration: 2500 }); this.loading = false; }
    });
  }

  inscribirme(cursoId: string) {
    const user = this.auth.usuario;
    if (!user) { this.snack.open('Inicia sesión', 'Cerrar', { duration: 2500 }); return; }
    this.http.post('/api/inscripciones', { estudiante: (user as any)._id, curso: cursoId }).subscribe({
      next: () => this.snack.open('Inscripción enviada', 'OK', { duration: 2000 }),
      error: () => this.snack.open('No se pudo inscribir', 'Cerrar', { duration: 2500 })
    });
  }
}