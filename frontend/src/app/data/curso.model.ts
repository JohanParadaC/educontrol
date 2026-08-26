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
