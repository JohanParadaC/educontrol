# Auditoría de arquitectura — EduControl

**Fecha:** 11 de agosto de 2026
**Base de evidencia:** grafo de conocimiento generado con graphify sobre el commit `cea0843`
**Alcance:** 963 nodos · 1527 aristas · 82 comunidades · 141 ficheros · 6.590 líneas de código de producto

Todas las afirmaciones de este informe están respaldadas por métricas extraídas de `graphify-out/graph.json`. Donde el grafo no basta, se indica la verificación adicional realizada sobre el código.

---

## 1. Resumen ejecutivo

**La arquitectura de base es sana. El problema no es cómo está organizado el proyecto, sino que arrastra tres capas de sedimento de iteraciones anteriores que nadie ha retirado.**

Lo que el grafo confirma como correcto:

- **Cero ciclos de importación.** El informe los busca explícitamente y no encuentra ninguno.
- **Separación de capas limpia.** Cero aristas directas entre ficheros del frontend y modelos del backend. La frontera se respeta.
- **Acoplamiento bajo.** El 79 % de las aristas son internas a su comunidad; solo el 20 % cruzan. Un proyecto con capas mal cortadas invierte esa proporción.
- **Extracción de alta confianza.** 92 % de las aristas son EXTRACTED (estructura real, no inferencia). Solo 6 aristas AMBIGUOUS en todo el grafo.

Lo que el grafo destapa como deuda real, en orden de gravedad:

1. **Dos componentes hacen el mismo trabajo** y ambos están en el top-10 de nodos más conectados. Uno es inalcanzable por navegación normal.
2. **314 líneas de código defensivo contra una API que está en este mismo repositorio**, adivinando siete endpoints de los cuales tres devuelven 404 y cuatro ignoran el filtro que se les pasa.
3. **`backend/app.js` hace cinco trabajos distintos** y es, con diferencia, el mayor punto de paso del sistema.
4. **El README miente sobre el proyecto** en dos puntos verificables.

**Recomendación principal: no reestructurar el backend.** Las comunidades del grafo coinciden casi exactamente con las carpetas que ya existen. Reorganizarlo sería trabajo sin retorno. El esfuerzo debe ir a eliminar duplicación en el frontend y a partir dos ficheros concretos.

---

## 2. Mapa actual

### 2.1 Composición del grafo

Antes de interpretar nada, conviene saber de qué está hecho el grafo. No todo lo que cuenta es código:

| Tipo | Nodos | % |
|---|---|---|
| Código de producto | 442 | 45 % |
| Ficheros de configuración | 216 | 22 % |
| Tests | 165 | 17 % |
| Capturas de pantalla | 76 | 7 % |
| Documentación | 33 | 3 % |
| Sin fichero asociado | 31 | 3 % |

**Consecuencia práctica:** el informe avisa de «411 nodos aislados (42 %)» y lo presenta como posible falta de aristas. No lo es. Los tres mayores contribuyentes son `frontend/package.json` (39), `frontend/angular.json` (35) y `backend/package.json` (31): claves de configuración que por definición no se conectan con nada. Unos 150 de esos 411 son ruido de configuración, no arquitectura.

### 2.2 Los verdaderos centros de gravedad

El informe lista «God Nodes» por número de aristas. Esa lista **mezcla dos cosas distintas** —ficheros grandes y ficheros muy dependidos— y hay que separarlas para leerla bien.

| Nodo | Grado | Aristas internas | Consumidores reales | Lectura |
|---|---|---|---|---|
| `backend/app.js` | **59** | — | 28 ficheros lo importan | Punto de paso real del sistema |
| `ApiService` | 55 | **39** | 12 ficheros | Fichero grande, no cuello de botella |
| `Curso` (modelo front) | 40 | — | 9 ficheros | Modelo compartido, esperable |
| `AuthService` | 35 | — | 17 ficheros | Servicio transversal legítimo |
| `Usuario` (modelo front) | 32 | — | 6 ficheros | Normal |

**`ApiService` no es el problema que parece.** De sus 55 aristas, **39 apuntan a símbolos de su propio fichero**. Es un fichero de 414 líneas con 44 símbolos, no un nodo del que dependa media aplicación: solo 12 ficheros lo importan. Es un problema de *tamaño*, no de *acoplamiento*.

**`app.js` sí lo es.** Su centralidad de intermediación es **0,0784 — 2,4 veces la del siguiente nodo** (`keywords` de package.json, 0,0323, que es ruido). Es el punto por el que pasan más caminos del grafo.

### 2.3 Dónde se concentra el acoplamiento

Pares de comunidades con más aristas cruzadas:

| Aristas | Entre | Diagnóstico |
|---|---|---|
| **39** | Panel de administración (UI) ↔ Panel admin y servicio API | Concentración real |
| 11 | Panel admin y servicio API ↔ Rutas y guards | Esperable |
| 9 | Panel admin y servicio API ↔ Mi cuenta y errores HTTP | Esperable |
| 9 | Rutas y guards ↔ Servicio de sesión | Esperable |
| 5 | Controlador de usuarios ↔ Controlador de cursos | Bajo |

El pico de 39 entre las dos comunidades del panel de administración refleja lo que ya sabemos: `admin-dashboard.component.ts` (406 líneas, 27 nodos) contra `api.service.ts` (414 líneas, 44 nodos). Son los dos ficheros más grandes del frontend hablando entre sí.

### 2.4 Cohesión por comunidad

Las comunidades pequeñas y bien definidas puntúan alto (0,50–0,70): «Cadena de autorización» 0,50, «Acceso de demostración» 0,70, «Proyecto EduControl» 0,67. Las comunidades de configuración puntúan bajísimo (0,04–0,06), lo que es correcto: un `package.json` no tiene cohesión conceptual.

La cohesión media de las comunidades de código de producto se mueve entre 0,12 y 0,29. Es un valor sano para un proyecto de este tamaño.

---

## 3. Problemas detectados, priorizados por impacto

### 🔴 P1 — Dos componentes hacen el mismo trabajo, y uno es inalcanzable

**Evidencia del grafo:** `ProfessorClassesComponent` (15 aristas, god node #7) y `MisClasesComponent` (13 aristas, god node #8) aparecen ambos en el top-10. La comunidad 15 se etiquetó «Vista Mis clases (legado)» durante el etiquetado.

**Evidencia adicional verificada en código:**

- Ambos renderizan lo mismo: los cursos del profesor con sus alumnos inscritos.
- Cuatro sitios distintos del código envían a un profesor a `/profesor/dashboard`, nunca a `/dashboard`: `login.component.ts:89`, `landing.component.ts:53`, `navbar.component.ts:105`, `not-found.component.ts:56`.
- La ruta `/mis-clases` **redirige** a `/profesor/clases`, que carga `ProfessorClassesComponent`.
- `MisClasesComponent` solo se alcanza si un profesor escribe `/dashboard` a mano en la barra de direcciones.

**Además, es la fuente de la única inconsistencia de datos que el grafo marcó como AMBIGUOUS:**

> `Modelo Curso (nombre, descripcion, profesor)` → `MisClasesComponent template` · relation: `shares_data_with` · AMBIGUOUS

`mis-clases.component.html:5` usa `{{ c.nombre }}` mientras todo el resto del frontend usa `c.titulo` a través del mapper unificado. El grafo detectó la discrepancia sin que nadie se la señalara.

**Impacto:** 215 líneas muertas, un god node fantasma que distorsiona toda la lectura del grafo, y una inconsistencia de modelo de datos que sobrevivió a la unificación `titulo`/`nombre`.

---

### 🔴 P2 — 314 líneas defendiéndose de una API propia

**Evidencia:** `professor-classes.component.ts` es el tercer fichero de producto más grande del frontend (314 líneas, 14 nodos). Su cabecera declara que tolera cuatro nombres distintos para el campo curso, ocho para el alumno y cuatro para los identificadores, más tres estrategias de respaldo.

El método `getInscripcionesPorCursoSmart()` (línea 200) prueba **siete endpoints a ciegas**:

```
/api/inscripciones?curso=ID
/api/inscripciones?cursoId=ID
/api/inscripciones?clase=ID
/api/inscripciones?idCurso=ID
/api/cursos/ID/inscripciones
/api/cursos/ID/estudiantes
/api/matriculas?curso=ID
```

**Contrastado contra el backend, que está en este mismo repositorio:**

- `/api/matriculas` — no está montado en `app.js`. **404.**
- `/api/cursos/:id/inscripciones` — `cursos.routes.js` solo define `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`. **404.**
- `/api/cursos/:id/estudiantes` — mismo caso. **404.**
- Las cuatro variantes con query string — el endpoint existe, pero `obtenerInscripciones()` hace `Inscripcion.find()` **sin leer `req.query` en absoluto**. Devuelven la colección entera ignorando el filtro.

**Ninguno de los siete hace lo que el código cree que hace.** Es código escrito contra un backend imaginario cuando el real está a dos carpetas de distancia.

**Impacto:** aproximadamente 115 de las 314 líneas son puro respaldo especulativo. Peor que el peso: cualquiera que lea ese fichero concluirá que el contrato de la API es incierto, cuando es perfectamente conocido.

---

### 🟠 P3 — `app.js` hace cinco trabajos

**Evidencia:** grado 59 (el más alto del grafo), centralidad de intermediación 0,0784 (2,4× el siguiente), 18 nodos declarados, importado por 28 ficheros.

Los 18 nodos revelan las responsabilidades acumuladas:

| Responsabilidad | Nodos que la delatan |
|---|---|
| Raíz de composición (montar rutas) | `usuariosRoutes`, `authRoutes`, `cursosRoutes`, `inscripcionesRoutes`, `adminRoutes` |
| Servir la SPA estática | `fs`, `path`, `hayBuildFrontend` |
| Sembrar el administrador | `ensureAdminSeed()`, `bcrypt`, `Usuario` |
| Verificar el entorno | `{ verificarEntorno }` |
| Arrancar el servidor | `app`, `express`, `{ connectDB }` |

Que un modelo de Mongoose (`Usuario`) y `bcrypt` estén importados en el fichero de arranque del servidor es la señal más clara: la lógica de sembrado no pertenece ahí.

**Matiz honesto:** los «28 ficheros que importan app.js» son en su mayoría tests usando Supertest, que necesitan la instancia de Express. Eso es normal y no cuenta como acoplamiento problemático.

---

### 🟠 P4 — El README no coincide con la realidad

El proyecto **no tiene fichero de contexto para agentes** (`CLAUDE.md` ni `AGENTS.md`). El único global se limita a registrar graphify. El README hace de contexto de facto, y contiene dos afirmaciones falsas:

| El README dice | La realidad | Verificación |
|---|---|---|
| «`__tests__/` 62 tests» | **119 tests** | `npm test` → `Tests: 119 passed` |
| Lista 4 carpetas del frontend: `core/`, `admin/professor/student/`, `shared/` | **11 carpetas** | Faltan `auth/`, `cuenta/`, `dashboard/`, `landing/`, `mis-clases/`, `models/` |

Un fichero de estructura que omite seis de once carpetas es peor que no tenerlo: da falsa confianza.

---

### 🟡 P5 — `ApiService` y `AdminDashboardComponent`: dos ficheros de 400 líneas

414 y 406 líneas, 44 y 27 símbolos. No están mal diseñados —el acoplamiento hacia fuera es bajo— pero concentran el 39 % de las aristas cruzadas entre comunidades del frontend. Son candidatos naturales a división por recurso.

---

### 🟢 P6 — Ruido de configuración en el grafo

216 nodos (22 %) provienen de `package.json`, `angular.json` y `tsconfig`. Inflan el recuento de nodos aislados y meten nodos sin sentido arquitectónico (`keywords` aparece como segundo mayor puente del grafo con centralidad 0,0323, lo cual es un artefacto).

No es un problema del proyecto sino de la configuración de la herramienta, pero conviene saberlo para no sacar conclusiones equivocadas del próximo informe.

---

## 4. Estructura propuesta

### 4.1 Backend — **no tocar**

Esta es la recomendación más importante del informe, y es una recomendación de *no hacer nada*.

Las comunidades que el grafo detectó por sí solo coinciden casi exactamente con las carpetas que ya existen:

| Comunidad detectada | Carpeta real | Cohesión |
|---|---|---|
| «Controlador de usuarios» | `controllers/usuarios.controller.js` | 0,13 |
| «Controlador de cursos» | `controllers/cursos.controller.js` | 0,15 |
| «Controlador de inscripciones» | `controllers/inscripciones.controller.js` | 0,20 |
| «Modelos Curso e Inscripción» | `models/` | 0,15 |
| «Conexión a MongoDB» | `config/` | 0,16 |
| «Autenticación JWT» | `controllers/auth` + `middlewares/auth.js` | 0,15 |

Cuando el análisis de comunidades reproduce tu estructura de carpetas sin conocerla, la estructura es correcta. **Reorganizar el backend sería trabajo sin retorno.**

La única excepción es partir `app.js`:

```
backend/
  app.js              solo Express: middlewares globales, rutas, 404, errores
  server.js           NUEVO: arranque (connectDB, seed, listen)
  config/
    env.js            ya existe
    db.js             ya existe
    seed.js           NUEVO: ensureAdminSeed() sale de app.js
  static.js           NUEVO: servido de la SPA y cabeceras de caché
```

**Por qué:** los tests importan `app` para Supertest. Hoy importan también, de rebote, la lógica de sembrado y el servido de estáticos. Separar `app` de `server` es el patrón estándar de Express precisamente por esto, y elimina `bcrypt` y `Usuario` del fichero de arranque.

### 4.2 Frontend — reorganización por dependencia, no por rol

El problema del frontend no es que las carpetas por rol estén mal: `admin/`, `professor/`, `student/` son coherentes y el grafo las respeta. El problema es que hay **tres carpetas que no encajan en ningún criterio**: `models/` (datos), `mis-clases/` (duplicado), `dashboard/` (un conmutador de una sola función).

```
frontend/src/app/
  core/                    infraestructura transversal
    auth.service.ts        (17 ficheros lo importan — el más compartido)
    auth.guard.ts  admin.guard.ts
    token.interceptor.ts
    http-error.ts          (7 ficheros lo importan)

  data/                    NUEVO: el contrato con el backend, por recurso
    usuarios.api.ts        }  api.service.ts partido en tres
    cursos.api.ts          }  por el recurso que toca
    inscripciones.api.ts   }
    models/                curso.model.ts, usuario.model.ts, inscripcion.model.ts
    curso.mapper.ts        traducción nombre↔titulo (único punto)

  features/                una carpeta por pantalla, no por rol
    landing/  auth/  cuenta/
    admin/  profesor/  estudiante/

  shared/                  navbar, diálogos, estado-vista, material
```

**Razonamiento de cada cambio, con su evidencia:**

| Cambio | Por qué | Evidencia |
|---|---|---|
| Eliminar `mis-clases/` | Duplica `professor/`, inalcanzable por navegación, y es la fuente de la única arista AMBIGUOUS de datos | P1 |
| Eliminar `dashboard/` | Su único cometido es conmutar por rol, y las cuatro redirecciones del código ya lo hacen antes de llegar. Solo existe para mantener vivo `mis-clases` | P1 |
| `models/` → `data/models/` | Los modelos y el mapper son el contrato con el backend; hoy `curso.mapper.ts` vive en `models/` y `http-error.ts` en `core/` sin criterio que los distinga | Comunidad 22 «Modelo de datos y API REST» mezcla 7 nodos de frontend con 6 de backend: el grafo ya los ve como una sola cosa |
| Partir `api.service.ts` en tres | 414 líneas, 44 símbolos, 39 de sus 55 aristas son internas | §2.2 |
| `admin/professor/student` → `features/` | No cambia el contenido, solo hace explícito qué es una pantalla y qué es infraestructura | Las comunidades ya separan ambos grupos |

**Lo que NO propongo:** partir `AdminDashboardComponent` por ahora. Es grande (406 líneas) pero cohesivo, y partirlo sin una necesidad concreta añade indirección. Queda anotado como P5, no como acción.

---

## 5. Ahorro estimado

| Concepto | Líneas | Nodos del grafo |
|---|---|---|
| `mis-clases/` completo (ts + html) | 215 | 15 |
| `dashboard/` (conmutador + spec) | ~60 | 8 |
| Respaldos especulativos en `professor-classes` | ~115 | — |
| **Total** | **~390** | **23** |

Sobre 6.590 líneas de código de producto, es una reducción del **5,9 %**.

**El ahorro en líneas no es lo importante.** Lo que se gana:

- **Dos god nodes fantasma desaparecen del top-10**, con lo que la próxima lectura del grafo refleja la arquitectura real y no el sedimento.
- **Se elimina la única inconsistencia de modelo de datos** que quedaba tras la unificación `titulo`/`nombre`.
- **Desaparecen siete llamadas HTTP a endpoints que no existen**, tres de las cuales generan 404 en producción cada vez que un profesor abre sus clases.
- **`app.js` deja de importar `bcrypt` y un modelo de Mongoose**, y los 28 ficheros que lo importan dejan de arrastrar esa carga.

---

## 6. Plan de acción

### Fase 1 — Retirar sedimento (2-3 h, riesgo bajo)

1. Borrar `frontend/src/app/mis-clases/`.
2. Borrar `frontend/src/app/dashboard/` y sustituir la ruta `/dashboard` por una redirección por rol en el router.
3. Eliminar `getInscripcionesPorCursoSmart()` y la tolerancia de nombres de campo en `professor-classes.component.ts`; dejar la llamada única a `GET /api/inscripciones`.
4. Ejecutar las dos suites. **Criterio de aceptación: 119/119 backend y 26/26 frontend siguen en verde.**

> Riesgo: si algún test cubre `MisClasesComponent`, ajustarlo. El grafo indica que solo `dashboard.component.ts` lo referencia.

### Fase 2 — Sincronizar el contexto (30 min, riesgo nulo)

5. Corregir el README: 119 tests, once carpetas del frontend.
6. Crear `CLAUDE.md` en la raíz con lo que el grafo demuestra que es verdad: capas sin ciclos, frontera backend/frontend limpia, dónde vive cada cosa, y las reglas de autorización.

> Esto no es documentación por documentación: el README es hoy el único contexto del proyecto y contiene dos afirmaciones falsas verificables.

### Fase 3 — Partir los dos ficheros grandes (1 día, riesgo medio)

7. Separar `backend/app.js` en `app.js` + `server.js` + `config/seed.js` + `static.js`.
8. Partir `frontend/src/app/core/api.service.ts` en `data/usuarios.api.ts`, `data/cursos.api.ts`, `data/inscripciones.api.ts`.

> Hacerlo *después* de la Fase 1: partir un fichero que aún tiene consumidores muertos multiplica el trabajo.

### Fase 4 — Reorganizar carpetas (medio día, riesgo bajo pero diff grande)

9. Mover a la estructura `core/ · data/ · features/ · shared/`.

> Commit aparte, solo movimientos, sin cambios de lógica. Un `git mv` limpio se revisa en minutos; mezclado con cambios funcionales, no se revisa.

### Fase 5 — Reconstruir el grafo y comparar

10. `/graphify .` y contrastar: los god nodes deberían quedar en `ApiService` partido, `AuthService` y los modelos. Si `MisClasesComponent` sigue apareciendo, la Fase 1 no se completó.

---

## Anexo — Fiabilidad de esta auditoría

**Qué respalda el grafo directamente:** grados, centralidad, comunidades, cohesión, ciclos, aristas cruzadas, composición del corpus, la arista AMBIGUOUS de `mis-clases`.

**Qué verifiqué a mano porque el grafo no podía demostrarlo solo:** que las cuatro redirecciones evitan `/dashboard`, que los siete endpoints no existen o ignoran el filtro, el recuento real de tests y carpetas, y las líneas de cada fichero.

**Qué no cubre:** el grafo se construyó sobre el commit `cea0843`, que es el `HEAD` actual. Cualquier cambio posterior sin reconstruir invalidaría estas cifras. La extracción semántica cubrió 20 ficheros no-código; el resto del análisis es AST determinista.
