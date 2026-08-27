// src/app/models/curso.model.ts
import { Usuario } from './usuario.model';

export interface Curso {
  _id: string;
  // 👇 compat: algunos endpoints/backends devuelven 'nombre'
  nombre?: string; // ← backend
  titulo?: string; // ← usado en el front / compat
  descripcion: string;
  profesor?: string | Usuario; // puede llegar como id o como objeto
}

/**
 * Lo que devuelve `GET /api/cursos/:id`: el curso y su contexto.
 *
 * `matriculados` viene siempre —cuántos son es un dato del curso—, pero
 * `estudiantes` solo si quien pregunta gestiona el curso: su profesor o un
 * administrador. Es `undefined` y no `[]` a propósito: "no puedo verlos" y "no
 * hay ninguno" llevan a pantallas distintas, y aquí la diferencia decide si se
 * pinta la lista o no se menciona.
 */
export interface CursoDetalle {
  curso: Curso;
  matriculados: number;
  estudiantes?: Usuario[];
}
