// src/app/models/curso.model.ts
import { Usuario } from './usuario.model';

/** En qué punto de su vida está un curso. Lo mismo que el enum del modelo. */
export type EstadoCurso = 'abierto' | 'cerrado' | 'archivado';

export interface Curso {
  _id: string;
  // 👇 compat: algunos endpoints/backends devuelven 'nombre'
  nombre?: string; // ← backend
  titulo?: string; // ← usado en el front / compat
  descripcion: string;
  profesor?: string | Usuario; // puede llegar como id o como objeto

  /** Plazas. Ausente es "sin límite", que no es lo mismo que cero. */
  cupoMaximo?: number;
  estado?: EstadoCurso;
}

/**
 * Lo que se manda al crear o editar un curso.
 *
 * `cupoMaximo: null` significa "quítale el límite", y por eso el `null` vive
 * aquí y no en `Curso`: el servidor nunca lo devuelve —borra el campo—, así
 * que prometerlo en el modelo de lectura obligaría a comprobar dos formas de
 * "sin cupo" en cada sitio que lo mire.
 */
export type CursoEditable = Partial<Omit<Curso, 'cupoMaximo'>> & {
  nombre?: string;
  cupoMaximo?: number | null;
};

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
