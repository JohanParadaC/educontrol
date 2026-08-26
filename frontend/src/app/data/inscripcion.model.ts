import { Curso } from './curso.model';
import { Usuario } from './usuario.model';

/**
 * Una matrícula, con los campos que el backend tiene de verdad
 * (`models/Inscripcion.js`): estudiante, curso y fecha.
 *
 * Antes esta interfaz declaraba `estado: 'activa' | 'cancelada'` y `createdAt`,
 * que no existen en ningún sitio. TypeScript dejaba escribir `i.estado` y en
 * tiempo de ejecución era `undefined`: un contrato inventado es peor que no
 * tener tipos, porque parece que te está cubriendo.
 *
 * `estudiante` y `curso` llegan poblados en los listados y como identificador
 * si alguien los pide en crudo, de ahí la unión.
 */
export interface Inscripcion {
  _id: string;
  curso: string | Curso;
  estudiante: string | Usuario;
  fecha?: string;
}
