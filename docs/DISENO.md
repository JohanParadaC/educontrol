# Sistema de diseño de EduControl

Dirección **A — «consola académica»**: neutros fríos, acento contenido y densidad
real. El referente son Linear y el panel de Vercel, no una portada de producto.
La aplicación gestiona listas de gente y de cursos; el diseño va detrás de eso.

Se construye **encima de Angular Material 3**, no en su lugar. Material sigue
generando sus variables `--mat-sys-*`; lo que añadimos es un vocabulario propio
y un puente que reapunta esas variables a nuestros tokens. Así una tabla, un
diálogo o un paginador obedecen la paleta sin escribir una regla para cada uno.

Todo vive en [`frontend/src/styles.scss`](../frontend/src/styles.scss).

---

## De dónde venimos

Lo que había era el tema por defecto del schematic de Material:

- Barra azul saturada de 64 px y todo lo demás casi blanco: la página era un
  bloque de color y un vacío.
- Tarjetas gris sobre gris, sin borde ni sombra: se leían como bloques de fondo,
  no como objetos.
- Colores escritos a mano (`#1b5e20`, `#283593`, `rgba(0,0,0,.6)`) y dos escalas
  tipográficas conviviendo (`font-size: 40px` a pelo contra los tokens).
- Sin modo oscuro. `rgba(0,0,0,.6)` sobre fondo oscuro es invisible.

---

## Tokens

### Superficies

| Token            | Claro     | Oscuro    | Cuándo                                    |
| ---------------- | --------- | --------- | ----------------------------------------- |
| `--superficie-0` | `#ffffff` | `#0f172a` | Tarjetas, diálogos, barra superior         |
| `--superficie-1` | `#f8fafc` | `#0b1120` | Fondo de la página                         |
| `--superficie-2` | `#f1f5f9` | `#1e293b` | Cabeceras de tabla, chips, zonas hundidas  |
| `--borde`        | `#e2e8f0` | `#334155` | Contorno de tarjetas, separadores          |

La jerarquía es: la página está en `--superficie-1` y las tarjetas se levantan
sobre ella con `--superficie-0` más borde. En oscuro se invierte el orden de
luminosidad —el fondo es más oscuro que la tarjeta— pero la relación se mantiene.

### Texto

| Token            | Claro     | Oscuro    | Cuándo                                     |
| ---------------- | --------- | --------- | ------------------------------------------ |
| `--texto`        | `#0f172a` | `#f1f5f9` | Todo el texto de lectura                    |
| `--texto-suave`  | `#475569` | `#94a3b8` | Secundario: subtítulos, metadatos, etiquetas |

`--texto-suave` es slate-600 y no slate-500 por una razón medida: con `#64748b`
el texto secundario daba **4,34:1** sobre `--superficie-2`, por debajo del 4,5
que pide AA.

### Acento

| Token             | Claro     | Oscuro    | Cuándo                                  |
| ----------------- | --------- | --------- | --------------------------------------- |
| `--acento`        | `#2563eb` | `#60a5fa` | Acción primaria, enlaces, foco           |
| `--acento-fuerte` | `#1d4ed8` | `#93c5fd` | Hover, y texto sobre `--acento-suave`    |
| `--acento-suave`  | `#eff6ff` | `#172554` | Fondos teñidos, sección activa del menú  |
| `--sobre-acento`  | `#ffffff` | `#0b1120` | Texto encima de `--acento`               |

El azul es el color de **la acción**, no el fondo de una franja. Si algo azul no
se puede pulsar, está mal.

### Roles

| Token                | Claro     | Oscuro    |
| -------------------- | --------- | --------- |
| `--rol-estudiante`   | `#0ea5e9` | `#38bdf8` |
| `--rol-profesor`     | `#8b5cf6` | `#a78bfa` |
| `--rol-admin`        | `#f59e0b` | `#fbbf24` |

Cada rol tiene además su versión legible para texto: `--rol-*-texto`. El color
del rol sirve para **teñir un fondo**, no para escribir encima: `#f59e0b` sobre
blanco da 2,3:1. El chip usa el color al 14 % de fondo y el `-texto` encima.

Cuando un mismo bloque tiñe varias cosas con el color de un rol —la portada
pinta franja, icono y número— el par se resuelve **una vez** en el elemento que
lleva el rol escrito, con `[data-rol='…'] { --color-rol; --color-rol-texto }`, y
de ahí abajo lo hereda todo. La alternativa era repetir cada regla tres veces.

### Color de curso

Un curso no tiene color propio en la base de datos, pero su ficha necesita uno
para que dos cursos no se confundan de un vistazo. Se deriva del identificador,
y de él sale **solo el tono**:

| Token               | Claro  | Oscuro | Cuándo                                     |
| ------------------- | ------ | ------ | ------------------------------------------ |
| `--curso-tono`      | `220`  | `220`  | Respaldo. La ficha lo sobreescribe con el suyo |
| `--curso-sat`       | `60%`  | `55%`  | Saturación                                  |
| `--curso-luz`       | `42%`  | `62%`  | La franja: decorativa, sin texto encima     |
| `--curso-tinte-luz` | `94%`  | `22%`  | Fondo teñido, con `--texto` encima          |

El componente calcula un número de 0 a 359 y lo pone en `--curso-tono`; la
saturación y la luminosidad vienen de aquí porque son las que cambian entre
claro y oscuro. Un color entero calculado en TypeScript no sabría en qué tema
se va a pintar.

**Encima del tinte se escribe con `--texto` y solo con `--texto`.** Medido para
los 360 tonos: `--texto` sobre el tinte da como peor caso **14,56** en claro y
**6,89** en oscuro, mientras que `--texto-suave` sobre el mismo tinte cae a
**2,95** en oscuro con los amarillos. Es la misma regla de los roles: el color
tiñe fondos, no escribe.

### Estado

| Token      | Claro     | Oscuro    |
| ---------- | --------- | --------- |
| `--exito`  | `#059669` | `#34d399` |
| `--aviso`  | `#d97706` | `#fbbf24` |
| `--error`  | `#dc2626` | `#f87171` |

### Texto sobre color

Los colores de estado y de rol tiñen fondos; para escribir encima hay una
variante legible. No es una preferencia: medido sobre el propio tinte al
14-16 %, los colores base se quedan cortos.

| Token            | Claro     | Oscuro    | Sobre su tinte (claro) |
| ---------------- | --------- | --------- | ---------------------- |
| `--exito-texto`  | `#065f46` | `#34d399` | 3,18 → **6,49**        |
| `--aviso-texto`  | `#92400e` | `#fbbf24` | 2,68 → **5,97**        |
| `--error-texto`  | `#991b1b` | `#f87171` | 3,88 → **6,68**        |

En oscuro los colores base ya contrastan (7,12 · 10,69 · 5,34) y las variantes
son el mismo color: aclararlos más los volvería fosforito.

`--rol-estudiante-texto` pasó de sky-700 a **sky-800** por la misma razón: el
chip de la tabla de administración se quedaba en 4,30:1, por debajo del 4,5 de
AA. Era el único de los tres roles que no llegaba, y solo se ve midiendo.

### Forma y profundidad

| Token         | Valor                      | Cuándo                          |
| ------------- | -------------------------- | ------------------------------- |
| `--radio-sm`  | `6px`                      | Chips, campos pequeños           |
| `--radio-md`  | `10px`                     | Botones, KPI                     |
| `--radio-lg`  | `14px`                     | Tarjetas, diálogos               |
| `--sombra-1`  | dos capas al 6 % y 4 %      | Reposo de una tarjeta            |
| `--sombra-2`  | una capa al 8 %             | Hover, menús flotantes           |
| `--velo`      | `rgb(0 0 0 / 32%)`         | Fondo tras un diálogo o el menú  |
| `--transicion`| `150ms`                    | Cualquier cambio de estado       |

Las sombras son de slate (`rgb(15 23 42 / …)`) y no de negro puro: sobre neutros
fríos, el negro ensucia. `--velo` no se redefine en oscuro a propósito: es una
sombra sobre el contenido, no una superficie.

---

## Modo oscuro

Se activa solo, siguiendo al sistema, y está preparado para un selector manual:

```scss
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    @include tokens-oscuros;
  }
}

:root[data-theme='dark'] {
  @include tokens-oscuros;
}
```

Dos bloques a propósito. El `@media` cubre a quien no ha elegido nada; el
`[data-theme='dark']` permite que un futuro selector gane **en los dos
sentidos**, y el guard `:not([data-theme='light'])` es lo que deja forzar el
claro teniendo el sistema en oscuro.

**Regla que no se rompe:** ningún color tiene su única definición dentro de un
`@media`. Todo se declara en claro y los bloques oscuros solo redefinen. Un
token que solo existiera dentro del bloque oscuro sería `unset` en claro, y el
componente saldría transparente.

---

## Contraste

Comprobado recorriendo el DOM de las ocho pantallas en los dos modos, componiendo
cada color con alfa sobre su fondo real antes de medir:

| Modo   | Peor pareja medida                    | Ratio |
| ------ | ------------------------------------- | ----- |
| Claro  | `--error` sobre `--superficie-0`      | 4,83  |
| Oscuro | `--texto-suave` sobre `--superficie-2`| 5,71  |

**Cero elementos por debajo de AA** en ninguna de las dos. Tres cosas se
arreglaron gracias a esa medición y no a la vista:

1. `--texto-suave` pasó de slate-500 a slate-600 (4,34 → 6,92 sobre superficie-2).
2. El texto del chip de admin pasó a amber-800; con amber-700 se quedaba en 4,44.
3. Los controles deshabilitados de Material salían al 38 % de opacidad: sobre
   fondo oscuro daban **1,17:1**, o sea invisibles. El botón «Asignar profesor»
   desaparecía hasta que elegías curso y profesor. Ahora van al 55 %: parecen
   deshabilitados, pero se ven.

---

## Cómo usarlo

**Sí:**

```scss
.tarjeta {
  background: var(--superficie-0);
  border: 1px solid var(--borde);
  border-radius: var(--radio-lg);
  box-shadow: var(--sombra-1);
  color: var(--texto);
}

.subtitulo {
  color: var(--texto-suave);
  font: var(--mat-sys-body-medium);
}
```

**No:**

```scss
.tarjeta {
  background: #fff; /* no existe en oscuro */
  border-radius: 16px; /* ¿por qué 16 y no 14? */
}

.titulo {
  font-size: 40px; /* dos escalas tipográficas conviviendo */
  font-weight: 800;
  color: rgba(0, 0, 0, 0.6); /* invisible en oscuro */
}
```

Para tipografía, los tokens de Material: `--mat-sys-headline-large`,
`--mat-sys-title-medium`, `--mat-sys-body-medium`, `--mat-sys-label-large`. Un
`font-size` numérico solo se acepta con un comentario que lo justifique, y hoy
los únicos que quedan son tamaños de glifo de `<mat-icon>`, que se dimensionan
así por diseño de Material.

Para espaciado, la escala que ya existía: `--sp-1` (4px) a `--sp-7` (48px).

---

## Muestra

Las capturas de esta carpeta están hechas con el sistema aplicado:

| Pantalla                | Archivo                                    |
| ----------------------- | ------------------------------------------ |
| Portada                 | [00-portada.png](00-portada.png)           |
| Login                   | [01-login.png](01-login.png)               |
| Panel de administración | [02-admin.png](02-admin.png)               |
| Panel de profesor       | [03-profesor.png](03-profesor.png)         |
| Panel de estudiante     | [04-estudiante.png](04-estudiante.png)     |
| Login en móvil          | [05-movil-login.png](05-movil-login.png)   |
| Admin en móvil          | [06-movil-admin.png](06-movil-admin.png)   |
| **Admin en modo oscuro** | [07-admin-oscuro.png](07-admin-oscuro.png) |
| Ficha de curso           | [08-curso.png](08-curso.png)               |
| Registro de actividad    | [09-actividad.png](09-actividad.png)       |

Se regeneran con `npm run capturas` (necesita el servidor levantado; recorre
las pantallas con un Chrome sin interfaz). El script fija el tema en cada
captura con `Emulation.setEmulatedMedia`: sin eso, Chrome hereda el esquema del
sistema y las mismas capturas salen claras u oscuras según quién las regenere.
De paso pide `prefers-reduced-motion: reduce`, porque si no la portada se
capturaba a medio animar —y así se comprueba que con esa preferencia no queda
nada invisible.

La misma tanda escribe dos ficheros que **no** son documentación:
`frontend/public/captura-panel.webp` y `captura-panel-oscuro.webp`, el panel
que enseña el héroe de la portada. Van en webp y a escala 1 porque esas dos sí
las descarga quien abre la página.

---

## Lo que este documento no cubre

La **estructura** de los paneles —la barra lateral de 260 px, los KPI como
tarjetas, el menú `⋮` de la tabla, rellenar el vacío de los paneles de profesor
y estudiante— es la siguiente fase. Aquí solo está el vocabulario: colores,
formas, sombras y tipografía.
