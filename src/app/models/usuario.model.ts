export interface Usuario {
  _id: string;
  nombre: string;
  correo: string;
  rol: 'estudiante' | 'profesor' | 'admin';
}