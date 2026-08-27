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

| Carpeta     | Responsabilidad                                                                 |
| ----------- | ------------------------------------------------------------------------------- |
| `core/`     | Sesión, guards, interceptor, errores HTTP, rutas por rol                        |
| `data/`     | El contrato con el backend: un servicio por recurso, modelos y el mapper        |
| `features/` | Una carpeta por área: landing, auth, cuenta, admin, profesor, estudiante, curso |
| `shared/`   | Navbar, diálogos, estado-vista, módulo de Material                              |

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
- **La ficha del curso reparte por rol.** `GET /api/cursos/:id` devuelve siempre `matriculados` —cuántos son es un dato del curso— y añade `estudiantes` **solo** para el profesor de ese curso o un admin. La clave se omite, no se manda vacía: `[]` diría "no hay ninguno". Y el frontend pinta la lista porque la clave ha llegado, no porque crea que el rol da derecho: la autorización es del servidor.
- **Un estudiante se da de baja solo.** `DELETE /api/inscripciones/:id` lo puede usar el dueño de la matrícula o un admin. El profesor todavía no: echar a un alumno de clase es otra cosa y no está decidida.
- **Borrar arrastra lo que cuelga.** Borrar un curso borra sus inscripciones; borrar un estudiante, las suyas. Borrar un profesor con cursos devuelve **409** diciendo cuántos: en cascada se llevaría por delante las matrículas de todos sus alumnos sin avisar.

**Datos**

- El backend llama `nombre` a lo que la interfaz llama `titulo`. La traducción vive en `data/curso.mapper.ts` y **solo ahí**. No añadas `?? nombre` en ningún otro sitio: eso es lo que había antes, repetido nueve veces.
- Los listados están paginados con un tope duro de 100 por página. Sin ese tope, `?limit=999999` reintroduce el problema desde fuera.
- `GET /api/inscripciones` devuelve `estudiante` y `curso` **poblados**. No hace falta cruzar con la lista de usuarios.
- Ese listado también pagina, como los demás. El frontend pide `limit=100` (el tope) porque ninguna de sus pantallas tiene paginador propio todavía.
- **Filtrar es cosa del servidor.** `GET /api/cursos` acepta `?profesor=me`, `?profesor=<id>` y `?buscar=texto` (busca en nombre y descripción). Nada de descargar 100 cursos y filtrarlos en el navegador: con 101, el filtro miente sin decirlo. El texto de `?buscar=` se escapa antes de convertirlo en regex.
- **Los esquemas llevan `timestamps`.** Cuándo se creó algo no se puede reconstruir después: o se guarda desde el principio o se pierde. En `Inscripcion`, `fecha` sigue por compatibilidad, pero para código nuevo es `createdAt`.
- **El correo se guarda en minúsculas y sin espacios**, y cualquier búsqueda por correo pasa por `utils/correo.js`. Sin eso, `Ana@x.com` y `ana@x.com` eran dos cuentas distintas pese al índice único —para Mongo son valores diferentes— y quien se registraba en mayúsculas no podía entrar escribiendo su correo normal.
- **Lo que se pinta se acota en el modelo.** `Curso.nombre` 120 y `Curso.descripcion` 500. El panel de administración tenía un `DESC_LARGA = 200` para compactar los botones cuando el texto se desbordaba: un parche visual a un dato que nadie había acotado.
- **Matricular valida el contenido, no solo el formato.** Que un `ObjectId` esté bien escrito no quiere decir que exista: el curso tiene que estar (404) y el estudiante tiene que ser un estudiante (400). El duplicado lo decide el índice único capturando `E11000`, no un `findOne` previo: entre leer y escribir cabe otra petición.
- **Un curso lleno o no abierto devuelve 409, no 400.** El dato que manda el cliente está bien; lo que pasa es que el estado del recurso lo impide. `cupoMaximo` ausente es «sin límite» —nunca 0, que significaría «no cabe nadie»—, y quitarlo es borrar el campo, no guardarlo a `null`: «sin cupo» tiene una sola forma.
- **Los archivados salen del catálogo del estudiante, no de la base.** El filtro es `$ne: 'archivado'` y no `estado: 'abierto'`, porque así cubre también a los cursos anteriores al campo. Administración y profesorado los siguen viendo, etiquetados.
- **Auditar nunca tumba la operación.** `utils/auditoria.js` escribe sin que nadie lo espere y con su propio `catch`: si el registro falla, la acción ya ha ocurrido y devolver un 500 sobre un curso que sí se ha creado sería peor. Y se registran las acciones **administrativas**: matricularse o darse de baja uno mismo no entra, que es uso normal y taparía lo que importa.
- **El registro guarda la etiqueta del recurso, no solo su id.** La mitad de lo que se audita son borrados: sin el nombre congelado en el momento, la fila de «curso borrado» apunta a la nada justo cuando más falta hace leerla.
- **Matricular por correo es la vía del profesor.** `POST /api/inscripciones` acepta `estudianteId` (el panel de administración, que tiene la lista) o `correo` (el profesor, que no la tiene). No se abre `GET /api/usuarios` a los profesores para llenar un desplegable: eso es repartir el nombre y el correo de todos los estudiantes del centro para resolver un caso en el que ya se conoce a la persona.
- **El modelo del frontend copia al del backend, no lo inventa.** `data/inscripcion.model.ts` declaraba `estado` y `createdAt`, que no existen en `models/Inscripcion.js`: TypeScript dejaba escribirlos y en tiempo de ejecución eran `undefined`. Un contrato inventado es peor que no tener tipos.

**Superficie HTTP**

- `helmet` con CSP propia. `'unsafe-inline'` está **solo** en `style-src`, porque Material escribe estilos en línea en tiempo de ejecución. En `script-src` no, y por eso `inlineCritical` está desactivado en `angular.json`: Angular difería la hoja de estilos con un `onload=` en el atributo, la CSP lo bloqueaba y la aplicación salía sin estilos. Hay un paso de CI que lo vigila.
- Nada de CORS. El backend sirve su propio frontend: no hay petición cruzada que permitir, solo superficie que abrir.
- El login admite 5 intentos fallidos cada 15 minutos por IP+correo; acertar no consume intentos. El resto de `/api` tiene un tope laxo, desactivado en test.
- `errorHandler` traduce los errores de Mongo antes de que salgan: `CastError` → 400, `E11000` → 409, `ValidationError` → 400 con los campos. Un 5xx en producción sale genérico y el detalle se queda en el log.

**Interfaz**

- **Angular 20, escrito como Angular 20.** `@if`/`@for` (nunca `*ngIf`/`*ngFor`), guards e interceptor como funciones, estado en señales y `ChangeDetectionStrategy.OnPush` en todos los componentes.
- **Con OnPush, el estado que se pinta es una señal.** Asignar un campo dentro de un `subscribe` no marca la vista: la pantalla se queda como estaba. Si algo no se repinta, la respuesta es una señal, no un `markForCheck()`.
- **El panel de administración lo autoriza el servidor.** `adminGuard` es un `canMatch` que pregunta a `/api/auth/renew` antes de dejar entrar, así que un `rol` falseado en localStorage no pinta el panel —y ni siquiera descarga su bundle—. Si no puede entrar, va a la pantalla de inicio de su rol real, la que decide `core/rutas.ts`.

- **El interceptor no inyecta `AuthService`.** Lee el token del almacenamiento local con `tokenLocal()`. Inyectarlo formaba un ciclo —AuthService valida el token en su constructor, eso lanza una petición, la petición construye el interceptor y el interceptor pide AuthService— y Angular contestaba NG0200: la renovación moría sin salir al servidor, AuthService lo tomaba por un fallo y cerraba la sesión. Se veía como "inicio sesión, refresco y estoy fuera".
- **Una descarga se pide con HttpClient, no con un `<a href>`.** La API exige el token en una cabecera y un enlace normal no la manda: la descarga saldría 401. Se pide el blob, se lee el nombre de `Content-Disposition` —lo decide el servidor— y se entrega al navegador desde `shared/descargar.ts`, liberando el object URL.
- **Nada de `if (api.loQueSea)`.** `ApiService` está en este repositorio y se puede leer. Comprobar si existe un método es defenderse de una API imaginaria, y obliga a un `inject(ApiService) as any` que apaga el tipado del componente entero.

- Cargando, vacío y error son **tres estados distintos**. Usa `app-estado-vista`. Nunca conviertas un error en lista vacía con `catchError(() => of([]))`: "no tienes cursos" y "no he podido preguntarlo" llevan a acciones distintas.
- Los mensajes de error salen de `core/http-error.ts`, que distingue el fallo de red del rechazo del servidor. Un mensaje que dice "contraseña incorrecta" cuando el servidor está caído manda al usuario a arreglar lo que no está roto.
- En móvil las tablas se convierten en tarjetas (`lista-tarjetas`), no se encogen.
- La ruta de inicio de cada rol la decide `core/rutas.ts`. Un solo sitio.
- **El título de la barra superior sale de la navegación**, de la misma lista que pinta la lateral, para que no puedan desincronizarse. La excepción son las pantallas que no son un destino del menú —la ficha de un curso—: esas lo declaran en `data.titulo` de su ruta. Sin eso la barra decía "EduControl" en una página que sí sabe qué es.
- **La ficha de un curso (`/cursos/:id`) es el destino de todo enlace a un curso.** No hay ningún "Ir al curso" que lleve a un listado; si aparece uno, está mal.
- **Los colores y las formas salen de los tokens de `styles.scss`**, nunca escritos a mano. Un `#fff` no existe en modo oscuro y un `rgba(0,0,0,.6)` es invisible ahí. La tabla completa está en `docs/DISENO.md`.
- **Los tokens se declaran en claro y el bloque oscuro solo redefine.** Un color cuya única definición esté dentro de un `@media` queda `unset` en claro y el componente sale transparente.
- **El color del rol tiñe fondos; para escribir encima está `--rol-*-texto`.** El ámbar sobre blanco da 2,3:1. Lo mismo con los estados: `--exito-texto`, `--aviso-texto` y `--error-texto`, porque los tres colores base sobre su propio tinte se quedan entre 2,7 y 3,9.
- **Una acción bloqueada enseña el motivo al lado del botón.** Un botón apagado sin explicación deja a la gente probando a pulsarlo. La comprobación del cliente solo evita el viaje: el servidor la repite y devuelve 409.
- **Lo que se anima se declara DENTRO de `@media (prefers-reduced-motion: no-preference)`**, no se apaga fuera. Si el estado base es `opacity: 0` y se confía en una regla que lo revierta, basta con que esa regla no gane para dejar media pantalla invisible. Declarándolo dentro, quien pide menos movimiento simplemente no tiene animación.

## Convenciones

- Comentarios y mensajes de interfaz **en español**.
- Los tests de seguridad comprueban el efecto, no solo el código de estado: tras un 403 verifican que la contraseña antigua sigue funcionando.
- `npm test` debe quedar en verde antes de dar nada por terminado.

## Limitaciones conocidas

Están listadas en el README y son deliberadas, no descuidos. La más relevante: `POST /api/inscripciones` acepta el `estudianteId` del cuerpo sin comprobar de quién es. Lo necesita el panel de administración; la regla correcta sería que un estudiante solo pueda matricularse a sí mismo.
