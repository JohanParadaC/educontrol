// src/app/models/curso.mapper.ts
// ---------------------------------------------------------------------------
// Único punto de traducción entre el curso de la API y el de la interfaz.
//
// El backend llama `nombre` a lo que la interfaz llama `titulo`. Eso estaba
// parcheado con `c.titulo ?? c.nombre` repetido en nueve sitios de api.service:
// cada endpoint nuevo pagaba el impuesto y bastaba olvidarse una vez para que
// un listado saliera con los títulos vacíos.
//
// Regla: la API habla de `nombre`, la aplicación habla de `titulo`, y la
// conversión ocurre aquí y en ningún otro sitio.
// ---------------------------------------------------------------------------
import { Curso, CursoEditable } from './curso.model';

/** API → aplicación. Tolera respuestas envueltas en { curso: ... }. */
export function aCurso(origen: any): Curso {
  const c = origen?.curso ?? origen ?? {};
  return { ...c, titulo: c.titulo ?? c.nombre ?? '' } as Curso;
}

/** API → aplicación, para listas. */
export function aCursos(origen: any[] | null | undefined): Curso[] {
  return (origen ?? []).map(aCurso);
}

/**
 * Aplicación → API.
 * Solo incluye las claves presentes, para no pisar campos con `undefined` en
 * las actualizaciones parciales.
 */
export function deCurso(body: CursoEditable): Record<string, any> {
  const salida: Record<string, any> = {};

  const nombre = body.nombre ?? body.titulo;
  if (nombre !== undefined) salida['nombre'] = nombre;
  if (body.descripcion !== undefined) salida['descripcion'] = body.descripcion;

  // Estos dos viajan con el mismo nombre en los dos lados, pero tienen que
  // estar aquí igual: `deCurso` construye el cuerpo entero, y lo que no
  // aparezca no sale. `cupoMaximo: null` es "quítale el límite", así que se
  // deja pasar el null en vez de tratarlo como ausente.
  if (body.cupoMaximo !== undefined) salida['cupoMaximo'] = body.cupoMaximo;
  if (body.estado !== undefined) salida['estado'] = body.estado;

  // El backend espera el id del profesor, no el objeto poblado.
  if (body.profesor !== undefined) {
    const p: any = body.profesor;
    salida['profesor'] = typeof p === 'string' ? p : (p?._id ?? p?.id ?? null);
  }

  return salida;
}
