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
- El **rol autoriza, la propiedad también**. `roleCheck` dice qué clase de usuario puede entrar; de quién es el recurso lo decide el controlador, que para eso lo lee. Un profesor solo edita o borra los cursos donde `curso.profesor` es él; el admin, cualquiera.
- **Nadie lista lo que no le toca.** `GET /api/inscripciones` filtra por rol en el servidor: estudiante → las suyas, profesor → las de los cursos que imparte, admin → todas. Los filtros `?curso=` y `?estudiante=` se **cruzan** con esa regla, nunca la amplían. La misma regla se aplica al `GET /:id`: si filtras solo el listado, la fuga sigue abierta de una en una.
- **El login no dice qué falló.** Correo inexistente y contraseña mala devuelven el mismo 401 con el mismo texto, y se compara contra un hash señuelo cuando el usuario no existe: sin eso, el tiempo de respuesta delata la rama aunque el mensaje sea idéntico.
- **El token se firma en un solo sitio**, `utils/jwt.js`, con la duración de `JWT_EXPIRES_IN` (12 h por defecto). Había dos firmas conviviendo con duraciones distintas.
- **Una sola cabecera de sesión:** `Authorization: Bearer`. La antigua `x-token` ya no se acepta.
- **Un estudiante se da de baja solo.** `DELETE /api/inscripciones/:id` lo puede usar el dueño de la matrícula o un admin. El profesor todavía no: echar a un alumno de clase es otra cosa y no está decidida.
- **Borrar arrastra lo que cuelga.** Borrar un curso borra sus inscripciones; borrar un estudiante, las suyas. Borrar un profesor con cursos devuelve **409** diciendo cuántos: en cascada se llevaría por delante las matrículas de todos sus alumnos sin avisar.

**Datos**

- El backend llama `nombre` a lo que la interfaz llama `titulo`. La traducción vive en `data/curso.mapper.ts` y **solo ahí**. No añadas `?? nombre` en ningún otro sitio: eso es lo que había antes, repetido nueve veces.
- Los listados están paginados con un tope duro de 100 por página. Sin ese tope, `?limit=999999` reintroduce el problema desde fuera.
- `GET /api/inscripciones` devuelve `estudiante` y `curso` **poblados**. No hace falta cruzar con la lista de usuarios.
- Ese listado también pagina, como los demás. El frontend pide `limit=100` (el tope) porque ninguna de sus pantallas tiene paginador propio todavía.
- **Filtrar es cosa del servidor.** `GET /api/cursos` acepta `?profesor=me`, `?profesor=<id>` y `?buscar=texto` (busca en nombre y descripción). Nada de descargar 100 cursos y filtrarlos en el navegador: con 101, el filtro miente sin decirlo. El texto de `?buscar=` se escapa antes de convertirlo en regex.
- **El modelo del frontend copia al del backend, no lo inventa.** `data/inscripcion.model.ts` declaraba `estado` y `createdAt`, que no existen en `models/Inscripcion.js`: TypeScript dejaba escribirlos y en tiempo de ejecución eran `undefined`. Un contrato inventado es peor que no tener tipos.

**Superficie HTTP**

- `helmet` con CSP propia. `'unsafe-inline'` está **solo** en `style-src`, porque Material escribe estilos en línea en tiempo de ejecución. En `script-src` no, y por eso `inlineCritical` está desactivado en `angular.json`: Angular difería la hoja de estilos con un `onload=` en el atributo, la CSP lo bloqueaba y la aplicación salía sin estilos. Hay un paso de CI que lo vigila.
- Nada de CORS. El backend sirve su propio frontend: no hay petición cruzada que permitir, solo superficie que abrir.
- El login admite 5 intentos fallidos cada 15 minutos por IP+correo; acertar no consume intentos. El resto de `/api` tiene un tope laxo, desactivado en test.
- `errorHandler` traduce los errores de Mongo antes de que salgan: `CastError` → 400, `E11000` → 409, `ValidationError` → 400 con los campos. Un 5xx en producción sale genérico y el detalle se queda en el log.

**Interfaz**

- **El interceptor no inyecta `AuthService`.** Lee el token del almacenamiento local con `tokenLocal()`. Inyectarlo formaba un ciclo —AuthService valida el token en su constructor, eso lanza una petición, la petición construye el interceptor y el interceptor pide AuthService— y Angular contestaba NG0200: la renovación moría sin salir al servidor, AuthService lo tomaba por un fallo y cerraba la sesión. Se veía como "inicio sesión, refresco y estoy fuera".
- **Nada de `if (api.loQueSea)`.** `ApiService` está en este repositorio y se puede leer. Comprobar si existe un método es defenderse de una API imaginaria, y obliga a un `inject(ApiService) as any` que apaga el tipado del componente entero.

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
