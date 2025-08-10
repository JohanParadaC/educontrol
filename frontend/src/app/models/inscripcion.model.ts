import { Curso } from './curso.model';
import { Usuario } from './usuario.model';

export interface Inscripcion {
  _id: string;
  curso: string | Curso;
  estudiante: string | Usuario;
  estado: 'activa' | 'cancelada';
  createdAt?: string;
}