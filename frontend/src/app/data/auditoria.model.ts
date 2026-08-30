// src/app/data/auditoria.model.ts
// ---------------------------------------------------------------------------
// El registro de acciones administrativas, tal y como lo devuelve el backend.
//
// Copia al modelo de `models/Auditoria.js`, no lo inventa: `antes` y `despues`
// son `unknown` porque cada acción compara cosas distintas —un rol es una
// cadena, un curso son cinco campos— y declarar una forma concreta sería
// prometer un contrato que el servidor no cumple.
// ---------------------------------------------------------------------------

/** Las mismas que el enum del modelo. Si no está aquí, no se audita. */
export type AccionAuditada =
  | 'rol.cambiado'
  | 'usuario.correo'
  | 'usuario.borrado'
  | 'curso.creado'
  | 'curso.editado'
  | 'curso.borrado'
  | 'matricula.creada'
  | 'matricula.borrada';

export interface RegistroAuditoria {
  _id: string;
  /** Quién, con su nombre y rol congelados en el momento de la acción. */
  actor: string;
  actorNombre: string;
  actorRol: string;

  accion: AccionAuditada;

  /**
   * Sobre qué. `etiqueta` es cómo se llamaba entonces: la mitad de lo que se
   * audita son borrados, y sin ella el registro apuntaría a la nada.
   */
  recurso: {
    tipo: string;
    id?: string;
    etiqueta?: string;
  };

  antes?: unknown;
  despues?: unknown;

  createdAt: string;
}
