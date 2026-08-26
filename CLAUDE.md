# EduControl — contexto del proyecto

Plataforma de gestión académica: Angular 20 en el frontend, Express 5 y Mongoose en el backend, un solo proceso sirviendo ambos.

## Cómo se arranca

```bash
npm run install:all && npm run serve   # build del frontend + servidor en :3000
npm test                               # backend, 119 tests
npm run test:web                       # frontend, 25 tests
```

No hace falta instalar MongoDB: si no hay `MONGO_URI` ni un mongod local, el servidor levanta uno en memoria y siembra datos de ejemplo. Tampoco hace falta `.env`: en desarrollo los secretos que falten se rellenan con valores obvios y se avisa por consola.

## Arquitectura

**Un solo origen.** El backend sirve la SPA y la API. Por eso `apiBase` es `/api` relativo y no hay CORS que configurar.

**Backend**

| Fichero     | Responsabilidad                                                    |
| ----------- | ------------------------------------------------------------------ |
| `app.js`    | La aplicación Express y nada más: middlewares, rutas, 404, errores |
| `server.js` | Arranque del proceso: conectar, sembrar, escuchar                  |
| `static.js` | Servido de la SPA y cabeceras de caché                             |
| `config/`   | Entorno, conexión a Mongo, Mongo en memoria, seed del admin        |

`app.js` **no** conecta a la base ni llama a `listen()`. Los tests hacen `require('../app')` para Supertest y no deben provocar conexiones.

**Frontend**

| Carpeta     | Responsabilidad                                                          |
| ----------- | ------------------------------------------------------------------------ |
| `core/`     | Sesión, guards, interceptor, errores HTTP, rutas por rol                 |
| `data/`     | El contrato con el backend: un servicio por recurso, modelos y el mapper |
| `features/` | Una carpeta por área: landing, auth, cuenta, admin, profesor, estudiante |
| `shared/`   | Navbar, diálogos, estado-vista, módulo de Material                       |

## Reglas que no hay que romper

**Autorización**

- El rol se lee **de la base de datos**, no del claim del JWT. Un usuario degradado pierde el acceso de inmediato en lugar de conservarlo hasta que caduque el token.
- El registro público solo crea `estudiante` o `profesor`. **Nunca** `admin`: el rol jamás se toma del cuerpo de la petición sin filtrar.
- Ascender a profesor exige `PROFESOR_CLAVE`. Sin esa variable, nadie se auto-asigna el rol.
- Cambiar la **propia** contraseña exige la actual. Un admin sí puede restablecer la de otra persona: es una acción administrativa, no un cambio propio.
- `/api/admin/purge` y `/api/admin/seed-admin` solo existen fuera de producción. La comprobación es _fail-closed_: si `NODE_ENV` no está definida se asume producción y devuelven 404, no 403.

**Datos**

- El backend llama `nombre` a lo que la interfaz llama `titulo`. La traducción vive en `data/curso.mapper.ts` y **solo ahí**. No añadas `?? nombre` en ningún otro sitio: eso es lo que había antes, repetido nueve veces.
- Los listados están paginados con un tope duro de 100 por página. Sin ese tope, `?limit=999999` reintroduce el problema desde fuera.
- `GET /api/inscripciones` devuelve `estudiante` y `curso` **poblados**. No hace falta cruzar con la lista de usuarios.

**Interfaz**

- Cargando, vacío y error son **tres estados distintos**. Usa `app-estado-vista`. Nunca conviertas un error en lista vacía con `catchError(() => of([]))`: "no tienes cursos" y "no he podido preguntarlo" llevan a acciones distintas.
- Los mensajes de error salen de `core/http-error.ts`, que distingue el fallo de red del rechazo del servidor. Un mensaje que dice "contraseña incorrecta" cuando el servidor está caído manda al usuario a arreglar lo que no está roto.
- En móvil las tablas se convierten en tarjetas (`lista-tarjetas`), no se encogen.
- La ruta de inicio de cada rol la decide `core/rutas.ts`. Un solo sitio.

## Convenciones

- Comentarios y mensajes de interfaz **en español**.
- Los tests de seguridad comprueban el efecto, no solo el código de estado: tras un 403 verifican que la contraseña antigua sigue funcionando.
- `npm test` debe quedar en verde antes de dar nada por terminado.

## Limitaciones conocidas

Están listadas en el README y son deliberadas, no descuidos. La más relevante: `POST /api/inscripciones` acepta el `estudianteId` del cuerpo sin comprobar de quién es. Lo necesita el panel de administración; la regla correcta sería que un estudiante solo pueda matricularse a sí mismo.
