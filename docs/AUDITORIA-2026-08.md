# Auditoría EduControl — agosto 2026

**Alcance:** código completo del repositorio (backend Express/Mongoose + frontend Angular 20), capturas de `docs/`, configuración y tooling.
**Complementa** a `docs/AUDITORIA-ARQUITECTURA.md` (11-08-2026), que analizó la *estructura* del grafo. Este informe mira otra cosa: **seguridad, contrato de datos, calidad de código, rendimiento y diseño de producto**.

---

## Resumen ejecutivo

El proyecto está **muy por encima de la media de un CRUD académico**: separación app/server correcta, 119 tests de backend con regresiones de seguridad reales, paginación con tope duro, autorización leída de base de datos y no del token, estados de carga/error/vacío diferenciados. Nada de eso es habitual y conviene decirlo antes de la lista de problemas.

Dicho eso, hay **cuatro cosas que sí están mal de verdad**:

| # | Problema | Gravedad | Dónde |
|---|---|---|---|
| 1 | Cualquier profesor puede editar y borrar **cualquier** curso, no solo los suyos | 🔴 Alta | `routes/cursos.routes.js` |
| 2 | Cualquier usuario autenticado ve **todas** las inscripciones del sistema, con correos incluidos | 🔴 Alta | `controllers/inscripciones.controller.js` |
| 3 | Borrar un usuario o un curso deja **huérfanas** sus inscripciones y sus cursos | 🔴 Alta | `controllers/*.controller.js` |
| 4 | El login distingue "correo no registrado" de "contraseña incorrecta" → **enumeración de usuarios** | 🟠 Media | `controllers/auth.controller.js` |

Y **una cosa que está desactivada sin querer**: `provideNoopAnimations()` en `main.ts` apaga todas las animaciones de Material. Diálogos, menús, ripples y el paginador aparecen y desaparecen de golpe. Es una línea, y es probablemente la mejora de sensación/esfuerzo más alta de todo el proyecto.

En diseño el diagnóstico es simple: **la aplicación se parece exactamente a lo que genera `ng add @angular/material`**. Azul Azure por defecto, tarjetas gris sobre gris sin elevación ni borde, tipografía Roboto en un solo peso, y paneles con dos tarjetas flotando en dos tercios de pantalla vacíos. No es feo — es *anónimo*. La Parte 7 propone tres direcciones concretas.

**Nota global: 7,5 / 10.** Ingeniería sólida, producto a medio hacer, diseño sin identidad.

---

# Parte 1 — Seguridad y control de acceso

### 1.1 🔴 Un profesor puede editar y borrar cursos ajenos

`routes/cursos.routes.js` protege `PUT /:id` y `DELETE /:id` con `roleCheck('profesor','admin')`. Eso comprueba el **rol**, no la **propiedad**. Lucía puede borrar los cursos de Marcos.

```js
// routes/cursos.routes.js — actual
router.delete('/:id', [ validateJWT, roleCheck('profesor','admin'), ... ], borrarCurso);
```

Es el mismo error que ya se corrigió en `usuarios.controller.js` (la comprobación de propiedad antes de mirar el body), pero no se replicó en cursos.

**Regla correcta:** admin toca cualquier curso; un profesor solo aquellos donde `curso.profesor === req.usuario._id`.

### 1.2 🔴 `GET /api/inscripciones` filtra datos de todo el mundo

```js
const inscripciones = await Inscripcion.find()
  .populate('estudiante', 'nombre correo')   // ← correos de todos
  .populate('curso', 'nombre descripcion');
```

La ruta solo exige `validateJWT`. Un estudiante autenticado obtiene el nombre y el correo de **todos** los estudiantes del sistema y en qué cursos están. Además no está paginada: es el único listado del proyecto que se saltó el tope de 100.

Peor: el frontend **depende** de esto. `listInscripcionesMe()` y `listInscripcionesPorCurso()` se descargan la colección entera y filtran en el navegador. Arreglar la fuga obliga a añadir filtros de servidor, que es lo que había que hacer igualmente.

### 1.3 🔴 Borrados sin cascada → datos huérfanos

- `borrarUsuario` elimina un profesor → sus cursos quedan apuntando a un `ObjectId` que ya no existe. `populate('profesor')` devuelve `null` y la tarjeta muestra "Sin profesor asignado" para siempre.
- `borrarUsuario` elimina un estudiante → sus inscripciones sobreviven. El profesor sigue viendo un alumno fantasma.
- `borrarCurso` elimina un curso → sus inscripciones sobreviven apuntando a la nada.

No hay ningún test que cubra esto porque no hay ningún código que lo haga.

### 1.4 🟠 Enumeración de usuarios en el login

```js
if (!usuario)  return res.status(400).json({ msg: 'correo no registrado' });
if (!validPass) return res.status(400).json({ msg: 'Contraseña incorrecta' });
```

Dos mensajes distintos = un atacante puede averiguar qué correos existen sin acertar una sola contraseña. Debe ser un único `401` con "Correo o contraseña incorrectos", y conviene comparar contra un hash falso cuando el usuario no existe para no filtrar por tiempo de respuesta (el `bcrypt.compare` tarda; no ejecutarlo delata la rama).

### 1.5 🟠 Sin límite de intentos, sin cabeceras de seguridad

`backend/package.json` no incluye `helmet` ni `express-rate-limit`. Consecuencias:

- El login admite fuerza bruta ilimitada.
- No hay `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options` ni CSP: la SPA es *clickjackeable*.
- `app.use(cors())` abre el origen a cualquiera. Como el backend sirve el propio frontend (`static.js`), CORS no hace falta en absoluto: es superficie de ataque a cambio de nada.

### 1.6 🟠 `PUT /api/inscripciones/:id` es una asignación masiva

```js
Inscripcion.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
```

`req.body` entero, sin lista blanca. Un admin puede reescribir `estudiante`, `curso` y `fecha` de cualquier matrícula. Es rol admin, así que la gravedad baja — pero la ruta no tiene ningún caso de uso real en la interfaz. **Lo correcto probablemente es borrarla.**

### 1.7 🟡 Otros

- **`POST /api/inscripciones` acepta `estudianteId` del cuerpo.** Ya está documentado en el README como limitación consciente. Sigue siendo el agujero más citable en una entrevista: un estudiante puede matricular a otro. La regla correcta: admin y profesor matriculan a quien sea, el estudiante solo a sí mismo (`estudianteId ?? req.uid`, y rechazar si no coincide).
- **No se valida que `estudianteId` sea un estudiante ni que `cursoId` exista.** Se puede matricular a un admin en un curso inexistente y el sistema lo acepta.
- **`errorHandler` devuelve `err.message` tal cual** con estado 500. Un `CastError` o un `E11000 duplicate key` de Mongo se le muestra al usuario con nombres de colección e índices dentro.
- **La cabecera legacy `x-token` sigue soportada** en `middlewares/auth.js` y el interceptor la envía además del `Authorization`. Dos vías para lo mismo, el doble de superficie.
- **`utils/generarJWT.js` es código muerto** (firma a 2 h) — nadie lo importa; `auth.controller.js` firma inline a 12 h. Una de las dos duraciones es la que crees que tienes.
- **El logout es solo de cliente.** No hay lista de revocación: un token robado vale 12 horas hagas lo que hagas.
- **Sin `helmet`, sin logs estructurados.** `console.log`/`console.error` por todas partes; en producción no hay forma de correlacionar una petición con su error.

---

# Parte 2 — Modelo de datos

### 2.1 El campo `contraseña` lleva tilde

```js
contraseña: { type: String, required: true, minlength: 6 }
```

Y por eso arrastras `['contraseña']: hash` con notación de corchetes, `body.contrasena ?? body.contraseña ?? body.password` en el login, y un mapeo explícito en `auth.api.ts`. Es una decisión que **paga impuesto en las tres capas y en cada endpoint nuevo**. Renombrar a `passwordHash` con una migración de una línea elimina toda esa familia de parches. (Cuidado: es un cambio con migración; ver Prompt 5.)

### 2.2 Sin `timestamps`, sin índices útiles

- Ningún modelo tiene `{ timestamps: true }`. No sabes cuándo se creó un curso ni cuándo se modificó un usuario. `Inscripcion.fecha` es lo único parecido.
- `Usuario.rol` no está indexado, y `listUsuariosPorRol` filtra justo por ahí.
- `Curso.profesor` no está indexado, y es la clave de "mis clases".
- Con 6 usuarios da igual. Con 6.000 no.

### 2.3 El modelo `Inscripcion` no coincide con el frontend

`data/inscripcion.model.ts` declara:

```ts
estado: 'activa' | 'cancelada';
createdAt?: string;
```

Ninguno de los dos campos existe en `models/Inscripcion.js`. TypeScript te deja escribir `i.estado` y en tiempo de ejecución es `undefined`. Es un contrato inventado.

### 2.4 `Curso.descripcion` sin restricciones

Sin `maxlength`, sin `trim`. `admin-dashboard.component.ts` tiene un `DESC_LARGA = 200` para "compactar acciones" — un parche visual para un dato que el backend nunca acotó.

---

# Parte 3 — Contrato API ↔ frontend

### 3.1 🔴 Código muerto que se defiende de una API imaginaria

La auditoría anterior limpió `professor-classes.component.ts`. **El mismo patrón sobrevivió en los tres componentes de estudiante:**

```ts
// student-courses.ts, student-my-courses.ts, student-dashboard.ts
if (api.listMisInscripciones) return api.listMisInscripciones();   // no existe
if (api.listInscripcionesMe)  return api.listInscripcionesMe();    // sí existe
if (api.listInscripciones && api.me) { ... }                       // api.me() no existe
```

`ApiService` está en este repositorio. Se puede leer. Estas ramas nunca se ejecutan y el `inject(ApiService) as any` que las permite **desactiva el tipado en todo el componente**.

### 3.2 🔴 `/mis-cursos` es una pantalla rota y sin enlaces

`student-my-courses.component.ts` está enrutado pero **no aparece en el navbar**. Y si llegas por URL:

- `desmatricular()` llama a `this.api.deleteInscripcion` — no existe → muestra *"Tu API no expone endpoint para cancelar matrícula."*
- `irAlCurso()` muestra *"Navegación al curso próximamente 😉"*.
- Muestra `i.progreso`, un campo que el backend no tiene.

Son tres funciones y ninguna funciona. **O se implementa el desmatricularse (ver Prompt 4) o se borra el fichero.**

### 3.3 🟠 `updateCurso` hace GET + PUT sin necesidad

```ts
// cursos.api.ts
return completo ? enviar() : this.getCurso(id).pipe(switchMap(enviar));
```

El comentario dice *"el PUT del backend valida el curso completo"*. **Ya no es cierto**: `actualizarCurso` construye `update` solo con los campos presentes. El GET previo es una petición extra, una condición de carrera (lees, alguien edita, escribes encima) y complejidad muerta.

### 3.4 🟠 `listCursosDeProfesorMe()` filtra en el cliente

Se descarga hasta 100 cursos y compara ids en el navegador, con un respaldo que compara **nombres normalizados sin tildes** "por si los datos son antiguos". El backend debería aceptar `GET /api/cursos?profesor=me`.

### 3.5 🟡 Traducciones de nombres repartidas

- `nombre` (API) ↔ `titulo` (UI) → resuelto bien en `curso.mapper.ts`. ✅
- `curso`/`estudiante` (UI) ↔ `cursoId`/`estudianteId` (API) → resuelto en `inscripciones.api.ts`. ✅
- `password` ↔ `contraseña` → resuelto en `auth.api.ts`, **pero `auth.service.ts` vuelve a aceptar tres alias** (`password`, `contrasena`, `contraseña`). Duplicado.

---

# Parte 4 — Frontend: arquitectura Angular

### 4.1 🔴 Las animaciones están apagadas

```ts
provideNoopAnimations(),   // main.ts
```

El comentario dice *"o usa provideAnimations si las quieres reales"*. No las quieres desactivadas: diálogos que aparecen instantáneamente, ripples muertos, el menú móvil sin transición, el paginador seco. **Cambiar esta línea por `provideAnimationsAsync()` es la mejora de percepción más barata del proyecto.**

### 4.2 🟠 Angular 20 escrito como Angular 14

| Patrón actual | Idioma actual de Angular |
|---|---|
| `*ngIf` / `*ngFor` (13 ficheros, 0 usos de `@if`) | `@if` / `@for` / `@switch` |
| `class AuthGuard implements CanActivate` | `CanActivateFn` funcional |
| `HTTP_INTERCEPTORS` + `withInterceptorsFromDi()` | `withInterceptors([fn])` |
| `BehaviorSubject` + getters en `AuthService` | `signal()` / `computed()` |
| 0 componentes con `ChangeDetectionStrategy.OnPush` | OnPush por defecto |
| `MaterialModule` (barril de 12 módulos) | Imports directos por componente |

No es cosmética. `MaterialModule` sigue existiendo y cualquier componente que lo importe arrastra Sidenav, Expansion, List y Table a su bundle. Y sin `OnPush`, cada ciclo de detección reevalúa cosas como:

```ts
get usuario(): Usuario | null {
  const inMem = this.user$.value;
  if (inMem) return inMem;
  return JSON.parse(localStorage.getItem(this.USER_KEY)!);   // ← JSON.parse en cada CD
}
```

### 4.3 🟠 `accionesCompactas()` lee `window.innerWidth` desde la plantilla

```ts
accionesCompactas(c: Curso): boolean {
  const estrecha = window.innerWidth < 1200;   // ← se ejecuta en cada ciclo, por fila
  ...
}
```

Layout thrashing por fila y por ciclo, y encima **no reacciona al redimensionar** porque nada dispara la detección. Esto es CSS (`@container` o una media query), no TypeScript.

### 4.4 🟠 `AdminGuard` decide con datos de `localStorage`

Lee `auth.usuario`, que sale de `localStorage`. Un usuario puede editar esa clave en el navegador y **pintar el panel de administración**. No es una brecha real (la API rechaza cada petición con 403) pero la experiencia es pésima: ves el panel roto lleno de errores en vez de un "no tienes acceso". Debería usar `canMatch` y verificar contra `/api/auth/renew`.

Además redirige a `/cursos`, una ruta que un profesor no puede usar.

### 4.5 🟡 Plantillas gigantes dentro del `.ts`

| Componente | Líneas | Plantilla |
|---|---|---|
| `admin-dashboard` | 403 | fichero aparte ✅ |
| `student-dashboard` | 278 | **inline** |
| `student-courses` | 226 | **inline** |
| `professor-dashboard` | 205 | **inline** |
| `professor-classes` | 185 | **inline** |

Dos convenciones distintas en el mismo proyecto. Y las inline no las formatea Prettier ni las revisa el linter.

### 4.6 🟡 Dependencias sobrantes en `frontend/package.json`

- `@angular-devkit/build-angular` **y** `@angular/build`: dos builders instalados, se usa uno.
- `@angular/platform-browser-dynamic`: no se usa con `bootstrapApplication`.
- `express`: dependencia de producción del *frontend*, solo para `frontend/server.js`, que es **código muerto** — el backend ya sirve la SPA.

### 4.7 🟡 Sin i18n

Todos los textos están escritos a mano en español en las plantillas. Para un proyecto llamado "plataforma académica", soportar un segundo idioma implicaría tocar cada fichero. `@angular/localize` o un servicio de traducción resolverían esto de una vez.

---

# Parte 5 — Rendimiento

| Problema | Impacto |
|---|---|
| `GET /api/inscripciones` sin paginar ni filtrar, descargado entero por 4 componentes | 🔴 Crece linealmente con el sistema |
| Búsqueda del catálogo en cliente sobre 100 cursos | 🟠 Miente en cuanto haya 101 |
| Sin `OnPush` en ningún componente | 🟠 CD completa en cada evento |
| `JSON.parse(localStorage)` en getters usados desde plantillas | 🟠 Por ciclo de CD |
| `window.innerWidth` en método de plantilla | 🟠 Reflow por fila |
| Bundle inicial ~770 kB | 🟡 Documentado; `@defer` en el panel admin lo bajaría |
| Sin índices en `Usuario.rol` ni `Curso.profesor` | 🟡 Irrelevante hoy, caro luego |
| Sin `compression` en Express | 🟡 Gratis de añadir |

---

# Parte 6 — Calidad, tooling y operación

**Lo que hay y está bien:** 119 tests de backend con umbrales de cobertura ajustados a la realidad, tests de regresión de seguridad que comprueban el *efecto* y no solo el código de estado, `CLAUDE.md` como contexto de proyecto, README honesto con sus limitaciones.

**Lo que falta:**

- ❌ **Sin CI.** No hay `.github/workflows`. Los 119 tests solo se ejecutan si alguien se acuerda.
- ❌ **Sin ESLint.** Ni configuración ni dependencia, ni en frontend ni en backend. Nada impide otro `as any`.
- ❌ **Sin Prettier de verdad** (solo un `overrides` suelto en `package.json`).
- ❌ **Sin Docker / docker-compose.** "Levántalo con Mongo en memoria" es un buen truco, pero no es un despliegue.
- ❌ **Sin OpenAPI/Swagger.** El contrato de la API vive en la cabeza de quien la escribió.
- ❌ **Solo 10 ficheros de test en frontend** (25 tests). El componente de 403 líneas —`admin-dashboard`— no tiene ni uno.
- ❌ **Sin tests e2e.** Ningún Playwright/Cypress recorre "entro como estudiante → me matriculo → lo veo".
- ⚠️ **~40 ficheros modificados sin commitear** en el árbol de trabajo. Riesgo real de perder trabajo.
- ⚠️ **Historial de commits ilegible**: `arreglando el fix 3` aparece tres veces seguidas.
- ⚠️ `LICENSE` duplicado en raíz y en `backend/`.
- ⚠️ `/api/health` devuelve `{ok:true}` sin comprobar la base de datos. Un health-check que no comprueba nada siempre está verde.

---

# Parte 7 — Diseño y experiencia

## 7.1 Diagnóstico

Mirando `docs/00-portada.png`, `02-admin.png`, `03-profesor.png` y `04-estudiante.png`, el problema no es que esté mal hecho. Es que **está sin decidir**. Todo lo visual viene del schematic por defecto de Angular Material.

**Lo concreto:**

1. **Barra azul saturada de 64 px + todo lo demás casi blanco.** No hay niveles intermedios. La página es un bloque de color y un vacío.
2. **Las tarjetas no se leen como tarjetas.** `surface-container` gris sobre fondo gris claro, sin sombra, sin borde. Parecen bloques de fondo, no objetos.
3. **Los paneles de profesor y estudiante están vacíos.** Dos tarjetas en la franja superior y **dos tercios de pantalla en blanco**. A 1920 px es la primera impresión del producto.
4. **Los KPI son texto suelto.** "2 / Cursos activos" sin tarjeta, sin icono, sin color, sin comparación. No parecen métricas, parecen una errata.
5. **La tabla de administración pelea consigo misma.** Un `mat-select` relleno de gris dentro de cada celda de "Rol" convierte la tabla en un formulario; y tres botones de texto por fila (`Editar` · `Matricular` · `Eliminar`) desbordan el ancho de la tabla en la propia captura.
6. **La escala tipográfica es incoherente.** `professor-dashboard` usa `font-size: 40px; font-weight: 800` a pelo; el resto usa `--mat-sys-headline-small`. Dos sistemas conviviendo.
7. **Emoji 👋 como recurso de diseño.** Y `.subtitle { color: rgba(0,0,0,.6) }` codificado a mano, que en modo oscuro sería invisible.
8. **No hay modo oscuro.** `color-scheme: light` fijo. En 2026 es una expectativa, no un extra.
9. **Sin identidad.** Sin logo, sin ilustración, sin foto, sin color por curso, sin avatares. Nada distingue EduControl de cualquier otro CRUD azul.

## 7.2 Tres direcciones

### Dirección A — «Consola académica» ⭐ recomendada

*El referente son Linear, Vercel Dashboard, Notion.* Es la que mejor encaja con lo que la aplicación **ya hace**: gestionar listas densas de gente y cursos.

- **Barra lateral fija de 260 px** en ≥1024 px, con las secciones agrupadas por rol; la barra superior baja a 56 px y solo lleva buscador global (`⌘K`), notificaciones y avatar.
- **Neutros fríos, acento contenido.** El azul deja de ser el fondo de una franja y pasa a ser solo el color de la acción primaria.
- **Densidad real:** filas de 44 px, tipografía de tabla a 13-14 px, números tabulares.
- **Acciones en un menú `⋮`** al final de la fila en vez de tres botones; solo "Editar" queda visible al pasar el ratón.
- **KPI como tarjetas** con icono, número grande, etiqueta y una variación ("+2 esta semana").
- **Modo oscuro nativo** vía `prefers-color-scheme`.
- Coste: alto. Toca layout, navbar y las dos tablas. Es un rediseño.

### Dirección B — «Producto SaaS»

*El referente son Coursera, Teachable, Duolingo for Schools.* Vende mejor el proyecto en un portafolio.

- **Portada con gradiente en malla**, captura real del producto en perspectiva y prueba social.
- **Color por curso**: cada curso recibe un tono derivado de su nombre (hash → hue), con una franja superior en su tarjeta. Es la forma más barata de que un catálogo deje de parecer una lista.
- **Tarjetas con elevación 1 y borde de 1 px**, radio 12 px, y sombra al pasar el ratón.
- **Ilustraciones para los estados vacíos** en vez de un icono gris de Material.
- **Barras de progreso reales** por matrícula (requiere el campo `progreso` que el frontend ya finge tener).
- Coste: medio. Casi todo es CSS y datos derivados, no arquitectura.

### Dirección C — «Editorial serena»

*El referente son Readwise, Craft, la interfaz de Stripe Docs.*

- Tipografía con carácter en los títulos (Fraunces, Instrument Serif o similar) sobre Inter para el cuerpo.
- Fondo cálido (`#FAF9F7`) en vez de blanco puro; una sola línea de acento por sección.
- Mucho aire, pero **intencional**: contenido a 720 px con márgenes generosos, no dos tarjetas perdidas a 1920.
- Coste: bajo. Es tipografía, color y espaciado.

## 7.3 Arreglos de diseño que valen para cualquier dirección

Independientemente de lo que elijas, estos ocho cambios se pueden hacer hoy:

1. **Encender las animaciones** (`provideAnimationsAsync`).
2. **Dar borde y elevación a las tarjetas**: `border: 1px solid var(--mat-sys-outline-variant)` + `box-shadow` sutil.
3. **Convertir los KPI en tarjetas** con icono y número grande.
4. **Colapsar las acciones de tabla** en un menú `⋮`.
5. **Rellenar el vacío de los paneles**: mover cursos disponibles a una segunda columna, añadir "Actividad reciente", o pasar a un grid de 12 columnas real.
6. **Unificar la escala tipográfica**: prohibir `font-size` a pelo, todo con tokens `--mat-sys-*`.
7. **Añadir modo oscuro**: redefinir la paleta bajo `prefers-color-scheme: dark` y quitar los `rgba(0,0,0,.6)` codificados.
8. **Página de detalle de curso** — hoy "Ir al curso" lleva a un listado o a un snackbar de "próximamente". Es el agujero de producto más visible.

## 7.4 Tokens propuestos (Dirección A)

```scss
:root {
  /* Neutros fríos */
  --superficie-0: #FFFFFF;
  --superficie-1: #F8FAFC;
  --superficie-2: #F1F5F9;
  --borde:        #E2E8F0;
  --texto:        #0F172A;
  --texto-suave:  #64748B;

  /* Acento */
  --acento:       #2563EB;
  --acento-suave: #EFF6FF;

  /* Semánticos por rol */
  --rol-estudiante: #0EA5E9;
  --rol-profesor:   #8B5CF6;
  --rol-admin:      #F59E0B;

  /* Estado */
  --exito: #059669;
  --aviso: #D97706;
  --error: #DC2626;

  /* Radios y sombras */
  --radio-sm: 6px;  --radio-md: 10px;  --radio-lg: 14px;
  --sombra-1: 0 1px 2px rgb(15 23 42 / 6%), 0 1px 3px rgb(15 23 42 / 4%);
  --sombra-2: 0 4px 12px rgb(15 23 42 / 8%);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --superficie-0: #0B1120;
    --superficie-1: #0F172A;
    --superficie-2: #1E293B;
    --borde:        #334155;
    --texto:        #F1F5F9;
    --texto-suave:  #94A3B8;
    --acento-suave: #172554;
  }
}
```

---

# Parte 8 — Lo que le falta como producto

Ordenado por cuánto se nota su ausencia:

1. **Detalle de curso.** Todo enlace "Ir al curso" es mentira. Es *la* pantalla que falta.
2. **Desmatricularse.** El estudiante puede entrar, no puede salir. La pantalla existe y no funciona.
3. **Recuperación de contraseña.** Documentado como limitación. Requiere correo saliente.
4. **Búsqueda en servidor** en catálogo y desplegables (hoy tope de 100 y filtro en cliente).
5. **Contenido del curso**: materiales, temario, fechas, aula. Un "curso" hoy es un título, una descripción y un profesor.
6. **Progreso y calificaciones.** El frontend ya tiene el hueco (`progreso`, `promedio`) sin nada detrás.
7. **Cupo máximo por curso** y estado (abierto / cerrado / archivado).
8. **Auditoría de acciones administrativas**: quién cambió qué rol y cuándo.
9. **Notificaciones** al asignar un curso o matricular a alguien.
10. **Exportar a CSV** el listado de alumnos de un curso. Es la primera cosa que pide cualquier profesor real.

---

# Parte 9 — Plan por fases

| Fase | Contenido | Esfuerzo | Prompts |
|---|---|---|---|
| **0 · Higiene** | Commitear el árbol, ESLint + Prettier, CI en GitHub Actions | 2-3 h | 1 |
| **1 · Seguridad** 🔴 | Propiedad de cursos, fuga de inscripciones, cascadas, login genérico, helmet + rate-limit | 1-2 días | 2, 3 |
| **2 · Contrato** | Filtros de servidor, borrar el código duck-typed, arreglar o borrar `/mis-cursos` | 1 día | 4 |
| **3 · Modelo** | `timestamps`, índices, `maxlength`, alinear `Inscripcion` | 3-4 h | 5 |
| **4 · Angular al día** | Animaciones, `@if`/`@for`, guards funcionales, interceptor funcional, signals, OnPush | 2 días | 6, 7 |
| **5 · Rediseño** | Dirección elegida + los 8 arreglos transversales + modo oscuro | 3-5 días | 8, 9, 10 |
| **6 · Producto** | Detalle de curso, desmatricularse, exportar CSV | 3-4 días | 11, 12 |
| **7 · Robustez** | Tests de admin-dashboard, e2e con Playwright, Docker, OpenAPI | 2-3 días | 13, 14 |

---

# Parte 10 — Prompts listos para ejecutar

> Pensados para pegar de uno en uno en Claude Code, **en orden**, desde la raíz del repositorio. Cada uno es autocontenido y termina con criterios de aceptación verificables.
> Regla transversal: **`npm test` tiene que quedar en verde antes de dar cada prompt por terminado**, tal y como pide `CLAUDE.md`.

---

### Prompt 1 — Higiene del repositorio

```
Trabaja sobre el repositorio EduControl. Hay unos 40 ficheros modificados sin commitear:
revísalos con `git diff`, agrúpalos por tema y crea commits atómicos con mensajes
descriptivos en español (nada de "arreglando el fix"). No mezcles temas en un commit.

Después añade tooling de calidad, que hoy no existe:
1. ESLint en backend (eslint + eslint-config-node) y en frontend
   (angular-eslint), con reglas que prohíban `any` explícito y variables sin usar.
2. Prettier con .prettierrc en la raíz, aplicable a ambos paquetes.
3. Un workflow de GitHub Actions en .github/workflows/ci.yml que en cada push y PR:
   instale dependencias, ejecute lint, `npm test` (backend) y `npm run test:web`
   (frontend, ChromeHeadless), y falle si la cobertura baja de los umbrales de jest.config.js.
4. Scripts `lint` y `format` en el package.json raíz.

Elimina también el LICENSE duplicado de backend/ y el fichero muerto frontend/server.js
(el backend ya sirve la SPA vía static.js).

Criterios de aceptación:
- `git status` limpio.
- `npm run lint` pasa en los dos paquetes.
- El workflow es válido (`actionlint` o revisión manual del YAML).
- `npm test` sigue en verde.
```

---

### Prompt 2 — Cerrar los tres fallos críticos de control de acceso

```
En el backend de EduControl hay tres fallos de autorización. Arréglalos y fija cada uno
con tests de regresión que FALLEN contra el código actual, siguiendo el estilo de
backend/__tests__/seguridad.*.spec.js: comprobar el efecto, no solo el código de estado.

FALLO 1 — Propiedad de cursos.
routes/cursos.routes.js protege PUT /:id y DELETE /:id con roleCheck('profesor','admin'),
que valida el rol pero no la propiedad. Cualquier profesor puede editar o borrar el curso
de otro profesor.
Regla correcta: admin puede con cualquier curso; un profesor solo si
String(curso.profesor) === String(req.usuario._id). Si no, 403 sin efecto.
Impleméntalo en el controlador (necesita leer el curso), no en un roleCheck.

FALLO 2 — Fuga de datos en GET /api/inscripciones.
El controlador hace Inscripcion.find() sin filtro y devuelve estudiante y curso poblados,
con los correos de todos. La ruta solo exige validateJWT.
Regla correcta según el rol del solicitante:
  - estudiante → solo sus propias inscripciones,
  - profesor   → solo las de los cursos que imparte,
  - admin      → todas.
Añade además soporte de ?curso=<id> y ?estudiante=<id> (respetando siempre la regla de
rol) y paginación con el tope duro de utils/paginacion.js, que este listado se saltó.

FALLO 3 — Borrados sin cascada.
borrarUsuario y borrarCurso dejan datos huérfanos:
  - borrar un curso deja vivas sus inscripciones,
  - borrar un estudiante deja vivas sus inscripciones,
  - borrar un profesor deja cursos apuntando a un id inexistente.
Implementa:
  - borrarCurso → elimina también sus inscripciones,
  - borrar estudiante → elimina sus inscripciones,
  - borrar profesor → 409 si tiene cursos asignados, con un mensaje que diga cuántos
    (borrar en cascada los cursos de un profesor destruiría demasiado sin aviso).

Criterios de aceptación:
- Al menos 8 tests nuevos, y cada uno falla si revierto su arreglo.
- Los 119 tests existentes siguen pasando.
- El frontend sigue funcionando: revisa qué componentes llamaban a listInscripciones()
  esperando la colección entera y ajústalos.
```

---

### Prompt 3 — Endurecer la superficie HTTP

```
Endurece el backend de EduControl sin romper ningún test existente:

1. Enumeración de usuarios: auth.controller.js devuelve "correo no registrado" y
   "Contraseña incorrecta" como mensajes distintos. Unifícalos en un único 401 con
   "Correo o contraseña incorrectos". Ejecuta un bcrypt.compare contra un hash señuelo
   cuando el usuario no exista, para que el tiempo de respuesta no delate la rama.

2. Añade helmet con una CSP compatible con la SPA de Angular (Material inyecta estilos:
   necesitarás 'unsafe-inline' en style-src, documéntalo con un comentario).

3. Añade express-rate-limit: 5 intentos cada 15 minutos en POST /api/auth/login
   (por IP+correo), y un límite general más laxo para el resto de /api.

4. Quita `app.use(cors())`. El backend sirve el propio frontend desde el mismo origen
   (static.js), así que CORS no aporta nada y sí superficie. Si algún test lo necesita,
   déjalo activo solo cuando NODE_ENV === 'test'.

5. errorHandler devuelve err.message tal cual con estado 500, filtrando mensajes internos
   de Mongo (CastError, E11000). Mapea:
     - CastError    → 400 "Identificador no válido"
     - E11000       → 409 "Ese valor ya existe"
     - ValidationError → 400 con los campos afectados
   y en producción sustituye cualquier otro 500 por un mensaje genérico, dejando el
   detalle en el log.

6. Elimina la cabecera legacy x-token de middlewares/auth.js y del interceptor del
   frontend. Una sola vía: Authorization: Bearer.

7. Borra utils/generarJWT.js (código muerto, firma a 2h) y mueve la firma del token a un
   único helper que use una duración configurable por variable de entorno, con 12h por
   defecto. Documenta la variable en .env.example.

8. Añade compression y un logger de peticiones (pino-http o morgan) activo fuera de test.

Criterios de aceptación:
- `npm test` en verde.
- Un test nuevo comprueba que login con correo inexistente y login con contraseña mala
  devuelven exactamente la misma respuesta.
- Un test nuevo comprueba que el rate-limit devuelve 429 al sexto intento.
```

---

### Prompt 4 — Limpiar el contrato con el frontend

```
En el frontend de EduControl hay código que se defiende de una API imaginaria, aunque esa
API está en este mismo repositorio y se puede leer.

1. Elimina el duck-typing. En student-courses.component.ts, student-my-courses.component.ts
   y student-dashboard.component.ts hay cadenas como:
       if (api.listMisInscripciones) ...
       if (api.listInscripciones && api.me) ...
   Ninguno de esos métodos existe en ApiService. Bórralas, llama al método real
   (listInscripcionesMe / enrollMe) y quita el `inject(ApiService) as any`, que desactiva
   el tipado del componente entero.

2. Decide qué pasa con /mis-cursos. student-my-courses.component.ts está enrutado pero no
   enlazado desde el navbar, y sus tres acciones están rotas: desmatricular() llama a un
   método inexistente, irAlCurso() muestra "próximamente", y pinta un campo `progreso` que
   el backend no tiene.
   Implementa la opción correcta:
     a) Añade DELETE /api/inscripciones/:id para que un estudiante pueda darse de baja de
        SU propia matrícula (admin puede con cualquiera), con su test de autorización.
     b) Conéctalo en el componente, quita `progreso` de la interfaz y de la plantilla, y
        enlaza la pantalla desde el navbar para el rol estudiante.

3. Alinea data/inscripcion.model.ts con models/Inscripcion.js. Hoy declara
   `estado: 'activa'|'cancelada'` y `createdAt`, y ninguno existe en el backend.
   Deja solo los campos reales.

4. Simplifica cursos.api.ts → updateCurso(): hace un GET previo "porque el PUT valida el
   curso completo". Ya no es cierto: cursos.controller.js construye el update solo con los
   campos presentes. Quita el GET y el switchMap; es una petición extra y una condición
   de carrera.

5. Añade filtrado en servidor y úsalo:
   - GET /api/cursos?profesor=me  → cursos del profesor autenticado.
   - GET /api/cursos?buscar=texto → busca en nombre y descripción (índice de texto o regex
     con escape).
   Reescribe listCursosDeProfesorMe() para usar el primero y borra el respaldo que compara
   nombres normalizados sin tildes. Reescribe la búsqueda del catálogo del estudiante para
   usar el segundo, con debounce de 300 ms.

6. Quita los alias sobrantes de auth.service.ts login(): AuthApi ya traduce password →
   contraseña. Un solo nombre.

Criterios de aceptación:
- Cero apariciones de `as any` en features/.
- Cero comprobaciones `if (api.<algo>)` de métodos.
- `npm test` y `npm run test:web` en verde.
- Los nuevos endpoints tienen tests.
```

---

### Prompt 5 — Sanear el modelo de datos

```
Mejora los modelos de Mongoose de EduControl. Cada cambio de esquema necesita su test.

1. Añade { timestamps: true } a Usuario, Curso e Inscripcion. En Inscripcion mantén
   `fecha` por compatibilidad, pero marca en un comentario que createdAt la sustituye.

2. Añade índices donde se filtra de verdad:
   - Usuario: índice en `rol` (lo usa listUsuariosPorRol).
   - Curso:   índice en `profesor` (lo usa "mis clases").
   - Curso:   índice de texto en nombre + descripcion (para ?buscar=).

3. Añade restricciones que hoy no existen:
   - Curso.nombre: trim, maxlength 120.
   - Curso.descripcion: trim, maxlength 500. Con esto sobra el umbral DESC_LARGA=200 de
     admin-dashboard.component.ts, que es un parche visual a un dato sin acotar: quítalo.
   - Usuario.correo: lowercase y trim (hoy Ana@x.com y ana@x.com son dos cuentas
     distintas pese al índice único).

4. Elimina PUT /api/inscripciones/:id. Pasa req.body entero a findByIdAndUpdate (asignación
   masiva: permite reescribir estudiante, curso y fecha) y ningún componente lo usa.
   Borra la ruta, el controlador y sus tests; añade uno que compruebe que ahora devuelve 404.

5. La creación de inscripciones no valida nada del contenido: comprueba que cursoId existe
   y que estudianteId corresponde a un usuario con rol 'estudiante'. Devuelve 404 y 400
   respectivamente. Y sustituye el findOne-previo por captura del error E11000 del índice
   único, que hoy tiene una condición de carrera y acaba en 500.

6. OPCIONAL, con migración (hazlo solo si te lo confirmo aparte): renombrar el campo
   `contraseña` a `passwordHash`. La tilde obliga a notación de corchetes en seed.js,
   admin.controller.js y usuarios.controller.js, y a alias en auth.controller.js y
   auth.api.ts. Si lo haces, incluye un script de migración idempotente.

Criterios de aceptación:
- `npm test` en verde con tests nuevos para cada punto.
- Un test comprueba que dos correos que solo difieren en mayúsculas colisionan.
```

---

### Prompt 6 — Poner el frontend al día con Angular 20

```
El frontend de EduControl es Angular 20 escrito con idioma de Angular 14. Modernízalo sin
cambiar el comportamiento visible. Hazlo en pasos verificables, ejecutando
`npm run test:web` después de cada uno.

1. ENCIENDE LAS ANIMACIONES. main.ts usa provideNoopAnimations(), que apaga todas las
   transiciones de Material: diálogos, ripples, menú móvil y paginador aparecen de golpe.
   Cámbialo por provideAnimationsAsync().

2. Control de flujo nuevo: migra los 13 ficheros con *ngIf/*ngFor/*ngSwitch a @if/@for/@switch
   (`ng generate @angular/core:control-flow` y revisa el resultado a mano). @for exige track:
   usa los trackBy que ya existen.

3. Guards funcionales: convierte AuthGuard y AdminGuard (clases con CanActivate) en
   CanActivateFn. AdminGuard además decide con el usuario de localStorage, que el usuario
   puede editar: hazlo canMatch y verifica contra /api/auth/renew antes de dejar pasar, para
   que un rol falseado no llegue a pintar el panel roto. Y redirige a la ruta de inicio del
   rol real usando core/rutas.ts, no a /cursos fijo (un profesor no puede entrar ahí).

4. Interceptor funcional: sustituye TokenInterceptor (clase + HTTP_INTERCEPTORS +
   withInterceptorsFromDi) por una función con withInterceptors([tokenInterceptor]).
   Aprovecha para enviar solo Authorization: Bearer (la cabecera x-token desaparece).

5. Signals en AuthService: sustituye el BehaviorSubject y los getters por
   `usuario = signal<Usuario|null>(null)` y `estaAutenticado = computed(...)`.
   Importante: el getter actual hace JSON.parse(localStorage) en cada acceso y se llama
   desde plantillas, o sea en cada ciclo de detección. Lee localStorage UNA vez al arrancar.
   Mantén la protección contra la condición de carrera de validateToken() — está bien
   pensada y hay un test que la cubre.

6. OnPush en todos los componentes: añade
   changeDetection: ChangeDetectionStrategy.OnPush. Donde rompa, es señal de mutación de
   estado sin marcar; arréglalo con signals, no con markForCheck() a voleo.

7. Borra shared/material.module.ts. Es un barril de 12 módulos; cada componente que lo
   importa arrastra Sidenav, Expansion, List y Table a su bundle. Cambia sus consumidores
   por imports directos.

8. Extrae a .html y .scss las plantillas inline de student-dashboard (278 líneas),
   student-courses (226), professor-dashboard (205) y professor-classes (185): el resto del
   proyecto ya usa ficheros aparte y las inline no las toca Prettier.

9. Limpia frontend/package.json: sobran @angular-devkit/build-angular (se usa
   @angular/build), @angular/platform-browser-dynamic (no aplica con bootstrapApplication) y
   express (era para frontend/server.js).

Criterios de aceptación:
- `npm run test:web` en verde.
- `npm run build` sin avisos nuevos y sin superar el presupuesto de 800 kB.
- Cero apariciones de *ngIf, *ngFor, HTTP_INTERCEPTORS y provideNoopAnimations.
```

---

### Prompt 7 — Rendimiento medible

```
Optimiza el rendimiento de EduControl y demuéstralo con números antes/después.

1. Mide primero: `npm run build` y anota el tamaño del bundle inicial; con Lighthouse en
   modo escritorio anota LCP y TBT del panel de administración.

2. admin-dashboard.component.ts llama a accionesCompactas() desde la plantilla, y ese
   método lee window.innerWidth: se ejecuta por fila y por ciclo de detección, provoca
   reflow y encima no reacciona al redimensionar. Resuélvelo con CSS
   (container queries o media query), no con TypeScript.

3. Aplica @defer al panel de administración (403 líneas + tablas + diálogos) y a los
   diálogos de crear curso y matricular, con placeholder de esqueleto.

4. Añade `compression` en el backend y comprueba el tamaño transferido.

5. Revisa peticiones duplicadas: cargarTodo() dispara cargarUsuarios, cargarCursos y
   cargarOpciones, y cargarOpciones pide cursos otra vez con otro límite. Únelo.

6. Los avatares y las listas de cursos se repintan enteros: verifica que todos los @for
   tienen track por id estable.

Criterios de aceptación:
- Una tabla en el PR con bundle, LCP y TBT antes y después.
- El bundle inicial baja de 770 kB.
- `npm run test:web` en verde.
```

---

### Prompt 8 — Sistema de diseño (base para cualquier dirección)

```
EduControl usa hoy el tema por defecto de Angular Material (paleta Azure del schematic),
y se nota: barra azul saturada, tarjetas gris sobre gris sin borde ni elevación, y
font-size: 40px escrito a pelo en professor-dashboard mientras el resto usa tokens.

Construye un sistema de diseño propio ENCIMA de Material 3, sin abandonarlo:

1. En src/styles.scss, define una capa de tokens propios sobre los --mat-sys-*:
   superficies (0/1/2), borde, texto, texto-suave, acento, acento-suave, colores por rol
   (estudiante/profesor/admin), semánticos (éxito/aviso/error), radios (6/10/14) y dos
   niveles de sombra. Usa la paleta de neutros fríos slate.

2. Añade modo oscuro completo: redefine SOLO los tokens bajo
   @media (prefers-color-scheme: dark) con el guard :root:not([data-theme="light"]), y de
   nuevo bajo :root[data-theme="dark"] para que un futuro selector manual gane en ambos
   sentidos. Ningún color puede tener su única definición dentro de un bloque de media query.

3. Erradica los colores y tamaños codificados a mano. Busca en todo frontend/src:
   rgba(0,0,0,.6), #1b5e20, #283593, rgba(255,255,255,.04), font-size: 40px,
   font-weight: 800 — y sustitúyelos por tokens. En modo oscuro, rgba(0,0,0,.6) es
   invisible.

4. Unifica la escala tipográfica: todos los títulos con --mat-sys-headline-* o
   --mat-sys-title-*. Prohibido font-size numérico salvo en casos justificados con comentario.

5. Da entidad a las tarjetas: border 1px sólido con el token de borde, radio 14 px,
   sombra-1 en reposo y sombra-2 al pasar el ratón con una transición de 150 ms. Hoy son
   gris sobre gris y se leen como bloques de fondo, no como objetos.

6. Documenta el sistema en docs/DISENO.md con una tabla de tokens, cuándo usar cada uno y
   una muestra visual.

Criterios de aceptación:
- Cero colores literales fuera de la definición de tokens en styles.scss.
- La aplicación entera es legible y con contraste AA en claro y en oscuro.
- Ninguna regresión visual en las capturas de docs/ (regenera con `npm run capturas`).
```

---

### Prompt 9 — Rediseñar los paneles (Dirección A: consola académica)

```
Rediseña la interfaz de EduControl siguiendo la Dirección A del informe de auditoría:
una consola de gestión densa y seria, estilo Linear o el panel de Vercel. Usa los tokens
del Prompt 8.

PROBLEMA A RESOLVER: hoy los paneles de profesor y estudiante muestran dos tarjetas en la
franja superior y dejan dos tercios de la pantalla en blanco. Los KPI son texto suelto
("2 / Cursos activos") sin tarjeta, sin icono y sin contexto.

1. LAYOUT. Sustituye la barra superior azul de 64 px por:
   - Una barra lateral fija de 260 px a partir de 1024 px, con las secciones del rol
     agrupadas, el usuario abajo y un botón de colapsar a 64 px (solo iconos).
   - Una barra superior de 56 px con: título de la sección, buscador global y avatar.
   - Por debajo de 1024 px, la lateral se convierte en un drawer; conserva el
     comportamiento del menú móvil actual (cierre con Escape, cierre al navegar, capa de
     fondo) y sus tests.

2. TARJETAS KPI. Convierte los KPI del panel de profesor en tarjetas reales: icono en
   contenedor teñido, número en display-small con cifras tabulares, etiqueta en
   body-small, y una línea de variación cuando haya datos para calcularla.

3. LLENAR LA PÁGINA. Reorganiza los paneles en un grid de 12 columnas:
   - Estudiante: "Tus cursos" a 8 columnas + una columna lateral de 4 con próximos pasos y
     accesos rápidos; "Cursos disponibles" debajo, a ancho completo.
   - Profesor: KPI en fila de 3-4, "Tus clases" a 8 columnas + lateral con los últimos
     alumnos matriculados.

4. TABLA DE ADMINISTRACIÓN. Es la pantalla que peor está:
   - Filas de 44 px, tipografía de 13-14 px, cifras tabulares.
   - El mat-select de rol dentro de cada celda convierte la tabla en un formulario:
     muéstralo como chip de color por rol y abre un menú al hacer clic.
   - Los tres botones de texto (Editar · Matricular · Eliminar) desbordan el ancho. Deja
     "Editar" visible al pasar el ratón y mete el resto en un menú ⋮ al final de la fila.
   - Añade cabecera fija al hacer scroll y selección múltiple con acciones en lote (el
     guardado en lote de roles ya existe: reutilízalo).
   - Conserva el comportamiento móvil de tarjetas (lista-tarjetas) tal y como está: es
     correcto y hay tests.

5. ESTADOS VACÍOS. app-estado-vista funciona bien pero usa un icono gris de Material.
   Sustitúyelo por una ilustración SVG en línea, monocroma, que use los tokens.

Criterios de aceptación:
- Sin scroll horizontal entre 320 px y 2560 px.
- Navegación completa por teclado, con foco visible (respeta las reglas de :focus-visible
  que ya hay en styles.scss).
- Contraste AA en claro y oscuro.
- `npm run test:web` en verde, incluidos los tests del navbar.
- Regenera docs/*.png con `npm run capturas`.
```

---

### Prompt 10 — Rediseñar la portada

```
La portada de EduControl (features/landing) es texto centrado sobre fondo casi blanco, con
tres tarjetas grises y una lista ordenada. Es correcta y no vende nada.

Rediséñala para que alguien que llega sin contexto entienda el producto en cinco segundos:

1. Héroe con profundidad: fondo con gradiente sutil (usa los tokens de acento, sin
   estridencias), titular en display-medium, entradilla a máximo 60 caracteres por línea,
   y a la derecha una captura real del panel en perspectiva ligera con sombra
   (docs/02-admin.png ya existe). En móvil la captura pasa debajo.

2. Los tres perfiles: en vez de tres tarjetas idénticas, usa el color de rol de cada uno
   (estudiante/profesor/admin) en el icono y en una franja superior de 3 px. Hazlas
   clicables hacia la sección correspondiente de "Cómo funciona".

3. "Cómo funciona": convierte la lista ordenada en tres pasos horizontales con conector
   visual entre ellos, numerados en grande.

4. Refuerza el acceso de demostración: hoy es una línea de texto pequeño. Ponlo en una
   tarjeta con los tres roles y un botón por rol que entre directamente.

5. Añade un pie con enlaces al repositorio, la licencia y el stack.

6. Respeta prefers-reduced-motion: cualquier animación de entrada debe desactivarse.

Criterios de aceptación:
- Lighthouse: rendimiento ≥ 90 y accesibilidad ≥ 95 en la portada.
- Sin librerías nuevas: SVG y CSS.
- Funciona en claro y en oscuro.
```

---

### Prompt 11 — La pantalla que falta: detalle de curso

```
En EduControl, todos los enlaces "Ir al curso" son mentira: el del profesor lleva al listado
de clases, el del estudiante lleva al catálogo, y en /mis-cursos muestra un snackbar que
dice "Navegación al curso próximamente 😉". Es el agujero de producto más visible.

Crea la pantalla de detalle de curso en /cursos/:id:

BACKEND
- GET /api/cursos/:id ya existe y devuelve el curso con el profesor poblado. Amplíalo (o
  añade GET /api/cursos/:id/estudiantes) para incluir el número de matriculados, y la
  lista completa solo si el solicitante es el profesor del curso o un admin.
- Respeta la regla de privacidad del Prompt 2: un estudiante no puede ver la lista de sus
  compañeros.

FRONTEND
- Cabecera: título, descripción, profesor con avatar de iniciales, número de matriculados,
  y el color derivado del curso.
- Acción principal según rol y estado: "Matricularme" / "Cancelar matrícula" (estudiante),
  "Matricular estudiante" (profesor y admin), "Editar" (profesor propietario y admin).
- Pestaña de estudiantes: visible solo para profesor propietario y admin, con la tabla que
  hoy vive en professor-classes.
- Estados de carga, error y 404 con app-estado-vista; un id inexistente muestra "Ese curso
  no existe", no una pantalla en blanco.
- Actualiza TODOS los enlaces "Ir al curso" de professor-dashboard, professor-classes,
  student-dashboard, student-my-courses y student-courses para que apunten aquí.
- Añade migas de pan.

Criterios de aceptación:
- Ningún "próximamente" ni enlace que lleve a un listado en lugar de a un detalle.
- Tests: acceso por rol (un estudiante NO ve la lista de compañeros), 404, y matricularse
  y desmatricularse desde el detalle.
- `npm test` y `npm run test:web` en verde.
```

---

### Prompt 12 — Utilidades que pide un usuario real

```
Añade a EduControl las tres cosas que pediría cualquier profesor o administrador el primer
día de uso:

1. EXPORTAR A CSV la lista de alumnos de un curso.
   - Backend: GET /api/cursos/:id/estudiantes.csv, restringido al profesor del curso y a
     admin. Cabeceras correctas (Content-Disposition), BOM UTF-8 para que Excel no rompa
     las tildes, y escape de comas y comillas.
   - Frontend: botón "Exportar" en el detalle de curso y en "Mis clases".

2. CUPO Y ESTADO DEL CURSO.
   - Curso gana `cupoMaximo` (opcional, entero positivo) y `estado`
     ('abierto' | 'cerrado' | 'archivado', por defecto 'abierto').
   - Matricularse en un curso lleno o no abierto devuelve 409 con un mensaje claro.
   - La interfaz muestra "12 / 30 plazas" y desactiva el botón cuando no quedan, con el
     motivo visible (no un botón muerto sin explicación).
   - Los cursos archivados no salen en el catálogo del estudiante pero sí en el panel de
     administración con su etiqueta.

3. REGISTRO DE ACCIONES ADMINISTRATIVAS.
   - Modelo Auditoria: quién, qué acción, sobre qué recurso, cuándo, valor anterior y nuevo.
   - Registra: cambio de rol, creación/edición/borrado de curso, matriculación y baja
     hechas por un tercero.
   - Panel de administración: pestaña "Actividad" con la lista paginada y filtrable.

Criterios de aceptación:
- Tests para cada punto, incluidos los de autorización (un estudiante no exporta el CSV).
- El CSV abre correctamente en Excel con tildes y con un nombre que lleva comas.
- Migración: los cursos existentes quedan como 'abierto' y sin cupo.
```

---

### Prompt 13 — Cerrar el hueco de tests

```
EduControl tiene 119 tests de backend bien hechos y solo 25 en frontend, repartidos en 10
ficheros. El componente de 403 líneas —admin-dashboard— no tiene ninguno.

1. Tests de admin-dashboard.component.ts con HttpTestingController:
   - Carga de las dos tablas por separado; que falle una NO debe vaciar la otra (esta
     separación de estado es una decisión de diseño explícita: fíjala con un test).
   - Cambios de rol en lote: acumular, cancelar, guardar, y qué pasa si una de las
     peticiones del forkJoin falla.
   - Paginación de las dos tablas de forma independiente.
   - Eliminación de curso con el diálogo de confirmación: confirmar y cancelar.
   - Que un error de carga se quede en pantalla y no se convierta en "no hay usuarios"
     (es el fallo que app-estado-vista viene a evitar).

2. Tests de los componentes de estudiante y profesor: los tres estados (cargando, error,
   vacío) y que un error NUNCA se pinte como lista vacía.

3. Tests e2e con Playwright, en e2e/, con un script `npm run test:e2e`:
   - Estudiante: entra con la cuenta demo, busca un curso, se matricula, lo ve en "Tus
     cursos", se da de baja.
   - Profesor: entra, ve sus clases y la lista de alumnos.
   - Admin: crea un curso, le asigna profesor, matricula a alguien, lo borra.
   - Un profesor NO puede editar el curso de otro profesor (regresión del Prompt 2).
   Arranca el servidor con Mongo en memoria (ya funciona sin instalar MongoDB).

4. Sube los umbrales de cobertura del frontend a la cobertura real menos unos puntos,
   igual que hace jest.config.js en el backend, y conéctalo al CI del Prompt 1.

Criterios de aceptación:
- Cobertura de frontend por encima del 60 % en sentencias.
- Los e2e pasan en local y en CI (ChromeHeadless).
- Ningún test depende del orden de ejecución.
```

---

### Prompt 14 — Dejarlo listo para desplegar

```
EduControl se arranca hoy con `npm run serve` y Mongo en memoria. Eso es un buen truco de
demostración, no un despliegue. Prepáralo para producción:

1. Dockerfile multi-etapa: etapa de build del frontend, etapa de dependencias de
   producción del backend, imagen final sobre node:22-alpine con usuario no root,
   HEALTHCHECK apuntando a /api/health y dumb-init como PID 1.

2. docker-compose.yml con la aplicación y un MongoDB con volumen persistente, variables en
   un .env y healthchecks encadenados (la app espera a que Mongo esté sano).

3. Health-check de verdad: /api/health devuelve {ok:true} sin comprobar nada, así que
   siempre está verde. Que verifique el estado de la conexión de Mongoose y devuelva 503
   cuando no esté lista. Añade /api/health/ready y /api/health/live separados.

4. Documenta la API con OpenAPI 3: escribe openapi.yaml a mano contrastándolo contra
   routes/ (no lo inventes), y sírvelo con swagger-ui-express en /api/docs, solo fuera de
   producción.

5. Apagado ordenado: SIGTERM cierra el servidor HTTP, espera a las peticiones en curso y
   desconecta Mongoose antes de salir.

6. Actualiza README.md con una sección de despliegue: variables obligatorias en producción
   (JWT_SECRET, MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD), cómo levantar con Docker, y qué
   comprobar después del primer arranque.

Criterios de aceptación:
- `docker compose up` levanta la aplicación funcionando en :3000 con Mongo persistente.
- Parar el contenedor no corta peticiones en curso.
- openapi.yaml valida con un linter de OpenAPI y coincide con las rutas reales.
```

---

## Cómo usarlos

- **Uno por uno, en orden.** Los prompts 2-5 cambian el contrato que consumen los prompts 6-12.
- **Un commit por prompt**, para poder revertir uno sin arrastrar el resto.
- **El Prompt 1 antes que nada**: sin CI ni linter, cada prompt siguiente introduce deuda que nadie detecta.
- **Antes del Prompt 9 hay que decidir la dirección de diseño.** Si prefieres la B o la C, dímelo y reescribo ese prompt.
- Si algún prompt sale demasiado grande, pártelo por sus puntos numerados — están escritos para ser independientes dentro de cada prompt.
