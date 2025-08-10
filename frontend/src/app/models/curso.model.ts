import { Usuario } from './usuario.model';

export interface Curso {
  _id: string;
  titulo: string;        // Asegúrate que coincide con el backend
  descripcion: string;
  // CAMBIO: puede venir como id (string) o como objeto Usuario
  profesor?: string | Usuario;
}