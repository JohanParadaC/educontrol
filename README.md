# EduControl

Plataforma de gestión de cursos, estudiantes y profesores. Angular 20 en el frontend, Express y MongoDB en el backend, con autenticación JWT y autorización por roles.

![Panel de administración](docs/02-admin.png)

<p align="center">
  <img src="docs/01-login.png" width="49%" alt="Pantalla de inicio de sesión">
  <img src="docs/04-estudiante.png" width="49%" alt="Panel del estudiante con sus cursos">
</p>

En móvil las tablas se convierten en tarjetas y la navegación pasa a un menú desplegable, en vez de encoger el diseño de escritorio:

<p align="center">
  <img src="docs/05-movil-login.png" width="32%" alt="Inicio de sesión en móvil">
  <img src="docs/06-movil-admin.png" width="32%" alt="Panel de administración en móvil, con una tarjeta por usuario">
</p>

---

## Arrancarlo

```bash
npm run install:all && npm run serve
```

Y abre <http://localhost:3000>. No hace falta instalar MongoDB: si no encuentra una base de datos, el servidor levanta una en memoria y la siembra con datos de ejemplo.

Un solo proceso sirve la API y la aplicación web desde el mismo origen, así que no hay CORS ni URLs absolutas que configurar.

### Entrar

La pantalla de login tiene un botón por rol que entra directamente. Si prefieres escribirlas:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@educontrol.com` | `Admin123*` |
| Profesora | `lucia@educontrol.com` | `Demo1234` |
| Estudiante | `ana@educontrol.com` | `Demo1234` |

### Desarrollo

```bash
npm run dev:api    # API con recarga en caliente, puerto 3000
npm run dev:web    # Angular dev server con proxy a la API, puerto 4200
```

---

## Qué hace

- **Administrador** — gestiona usuarios y sus roles, crea y edita cursos, asigna profesores y matricula estudiantes.
- **Profesor** — consulta los cursos que imparte y quién está matriculado.
- **Estudiante** — busca en el catálogo, se matricula y ve sus cursos.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 20 (standalone components), Angular Material 3, RxJS |
| Backend | Node.js, Express 5, Mongoose 8 |
| Base de datos | MongoDB (o en memoria para desarrollo) |
| Autenticación | JWT, contraseñas con bcrypt |
| Tests | Jest + Supertest (backend), Karma + Jasmine (frontend) |

## Estructura

```
backend/
  controllers/   lógica de cada recurso
  middlewares/   validateJWT, roleCheck, validación de campos, errores
  models/        esquemas de Mongoose
  routes/        definición de endpoints y sus validadores
  utils/         clave de profesor, generación de JWT
  __tests__/     62 tests, incluidos los de regresión de seguridad
frontend/src/app/
  core/          servicios de API y sesión, guards, interceptor
  admin/ professor/ student/    vistas por rol
  shared/        navbar, diálogos, módulo de Material
```

---

## Tests

```bash
npm test                        # backend: 62 tests
npm test --prefix frontend      # frontend: 10 tests
```

El backend cubre el CRUD completo, la validación de payloads, el manejo de errores y **la autorización**. Este último bloque nació de una auditoría del propio proyecto: se encontraron cuatro fallos de control de acceso y cada arreglo se fijó con tests de regresión que fallan contra el código anterior.

| Comprobación | Resultado esperado |
|---|---|
| `DELETE /api/admin/purge` sin token | 401 |
| `DELETE /api/admin/purge` con token de estudiante | 403 |
| `POST /api/admin/seed-admin` sobre una cuenta existente | no la modifica |
| `POST /api/usuarios` con `rol: admin` | 400 |
| `PUT /api/usuarios/:id` de un tercero | 403, sin efecto |
| Auto-ascenso a profesor sin clave | 403 |
| Cambiar la propia contraseña sin indicar la actual | 400 |
| Cambiarla con una contraseña actual equivocada | 403, la antigua sigue valiendo |
| `?limit=999999` en un listado | recortado al máximo permitido |

Los tests no solo comprueban el código de estado: verifican también que el efecto no ocurrió. Tras un 403 al intentar cambiar la contraseña del administrador, la contraseña original sigue siendo válida y la del atacante no.

---

## Seguridad

Decisiones que conviene conocer si vas a desplegarlo:

- **Las rutas destructivas no existen en producción.** `/api/admin/purge` y `/api/admin/seed-admin` solo se montan si `NODE_ENV` es `development` o `test`. La comprobación es *fail-closed*: si la variable no está definida, se asume producción. Devuelven 404, no 403, para no confirmar que la ruta existe.
- **El registro público solo crea estudiantes o profesores.** El rol nunca se toma del cuerpo de la petición sin filtrar. Un administrador solo se crea desde el servidor, con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
- **Ascender a profesor exige `PROFESOR_CLAVE`.** Si la variable no está configurada, nadie puede auto-asignarse el rol: solo lo concede un administrador.
- **La autorización lee el rol de la base de datos, no del token.** Un usuario degradado pierde el acceso de inmediato en lugar de conservarlo hasta que caduque su JWT.
- **Sin `ADMIN_PASSWORD` no se siembra el administrador en producción**, para no crear una cuenta con contraseña conocida.
- **Cambiar la propia contraseña exige la actual.** Una sesión olvidada abierta no basta para quedarse la cuenta. Un administrador sí puede restablecer la de otra persona: eso es una acción administrativa, no un cambio propio.
- **Los listados están paginados y con un tope duro** (100 por página). Sin ese tope, `?limit=999999` reintroduce desde fuera el problema que la paginación viene a evitar.

### Variables de entorno

Copia `backend/.env.example` a `backend/.env`. En desarrollo todas tienen valor por defecto y el servidor avisa por consola de cuáles está inventando.

| Variable | Para qué |
|---|---|
| `MONGO_URI` | Conexión a MongoDB. Sin ella, base en memoria. |
| `JWT_SECRET` | Firma de los tokens. **Obligatoria en producción.** |
| `PROFESOR_CLAVE` | Clave para ascender a profesor. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrador inicial. |

---

## Limitaciones conocidas

Escrito a propósito: son cosas detectadas y priorizadas, no sorpresas.

- **No hay recuperación de contraseña.** Si un usuario la olvida, solo un administrador puede restablecérsela.
- **Los desplegables de profesor y estudiante cargan como mucho 100 opciones.** Por encima de eso harían falta un buscador con filtro en servidor.
- **La búsqueda del catálogo filtra en cliente** sobre los cursos cargados (hasta 100). Con catálogos mayores hay que mover el filtro al servidor.
- **Queda código muerto** de iteraciones anteriores (`cursos/`, `mis-cursos/`, `dashboard/home/`).
- **El bundle inicial pesa ~800 kB** frente a un presupuesto de 500 kB, sobre todo por importar Angular Material completo.
- **Solo el catálogo del estudiante tiene estados de carga, vacío y error** diferenciados; el resto de vistas todavía no.

## Licencia

ISC
