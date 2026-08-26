# educontrol-frontend

**SPA para gestión de cursos, estudiantes y profesores**  
Frontend construido con **Angular** (standalone components) y **Angular Material**. Consume el backend REST de EduControl.

---

## 📋 Tabla de contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Prerequisitos](#prerequisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Scripts disponibles](#scripts-disponibles)
- [Routing (Angular)](#routing-angular)
- [Servicios y modelos](#servicios-y-modelos)
- [Guards y Auth](#guards-y-auth)
- [Estilos/UI](#estilosui)
- [Despliegue](#despliegue)
- [Troubleshooting](#troubleshooting)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

---

## 📝 Descripción

Interfaz web para EduControl que permite:

- Autenticación de usuarios (token en `localStorage`).
- Navegación por roles: **estudiante**, **profesor**, **admin**.
- Panel de **profesor** con saludo/KPIs y vista **“Mis clases”** mostrando alumnos inscritos.
- Catálogo de cursos para **estudiantes**.
- Integración 100% con el backend REST (Node/Express/Mongo).  
  _(El estilo y secciones siguen la misma línea que el README del backend.)_ :contentReference[oaicite:0]{index=0}

---

## ⚙️ Características

- **Angular 15+** con componentes **standalone** y **Router**.
- **Angular Material** para UI (toolbar, cards, tables, icons, etc.).
- **Formularios reactivos** con validaciones.
- **HttpClient** + servicios tipados para hablar con el backend.
- Manejo de sesión en **AuthService** (token + usuario en `localStorage`).
- **Guards** de ruta: `AuthGuard` (y `AdminGuard` opcional).
- Configuración de **proxy** en desarrollo para `/api`.

---

## 📦 Prerequisitos

- **Node.js** v18 o superior
- **npm** (o yarn/pnpm)
- **Angular CLI** recomendado (`npm i -g @angular/cli`)
- Backend en local (`http://localhost:3000`) o desplegado

---

## 🚀 Instalación

# 1. Entrar al proyecto del frontend

cd frontend

```text

# 2. Instalar dependencias
npm install
🔧 Configuración
Proxy de desarrollo (proxy.conf.json) para enrutar /api al backend local:

json
Copiar
Editar
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
Base URL del backend en producción: ajusta tu ApiService para usar
una API_BASE_URL proveniente de environment.ts / variable de entorno al hacer build.
```

---

## 🗂️ Estructura del proyecto

```text

src/
├── app/
│   ├── core/
│   │   ├── api.service.ts          # Endpoints HTTP al backend
│   │   ├── auth.service.ts         # Sesión: token/usuario/rol (localStorage)
│   │   ├── auth.guard.ts           # Protege rutas autenticadas
│   │   └── admin.guard.ts          # (Opcional) rutas solo admin
│   ├── shared/
│   │   ├── material.module.ts      # Reexporta Angular Material usado
│   │   └── navbar/                 # Top bar navegación
│   │       ├── navbar.component.ts
│   │       ├── navbar.component.html
│   │       └── navbar.component.scss
│   ├── auth/
│   │   └── login/                  # Login (redirige por rol)
│   │       ├── login.component.ts
│   │       ├── login.component.html
│   │       └── login.component.scss
│   ├── dashboard/                  # Dashboard genérico (alumno/neutral)
│   │   └── dashboard.component.ts
│   ├── professor/                  # Panel del profesor
│   │   ├── professor-dashboard.component.ts   # Saludo + KPIs + tarjetas
│   │   └── professor-classes.component.ts     # Cursos del profe + alumnos
│   ├── student/                    # Pantallas de estudiante
│   │   ├── student-courses.component.ts
│   │   └── student-my-courses.component.ts    # (si aplica)
│   ├── role-select/
│   │   └── role-select.component.ts
│   ├── mis-clases/                 # (legado si existe)
│   └── app-routing-module.ts       # provideRouter(routes) (standalone)
├── assets/
└── environments/                   # environments (si usas)
```

---

## ⚡ Scripts disponibles

Comando Descripción
npm start Arranca dev server con proxy (ng serve --proxy-config)
npm run build Compila producción en dist/
npm run lint Linter (si está configurado)

---

## 🧭 Routing (Angular)

Rutas principales (standalone + lazy):

Path Guardas Descripción
/login — Pantalla de login
/dashboard AuthGuard Dashboard genérico (alumno/neutral)
/profesor/dashboard AuthGuard Dashboard del profesor (saludo + KPIs)
/profesor/clases AuthGuard Mis clases (cursos del profe + alumnos)
/cursos AuthGuard Catálogo/listado para estudiantes
/admin AuthGuard+Admin Panel admin (opcional)
'' → /dashboard — Redirect inicial
** → /dashboard — Catch-all

En el Navbar, el botón Dashboard redirige a /profesor/dashboard cuando el rol es profesor, y a /dashboard en otros casos.
En Login, tras autenticarse, se redirige por rol (profesor → /profesor/dashboard).

---

## 🔌 Servicios y modelos

Servicios

ApiService

listCursosDeProfesorMe() – cursos asociados al profesor autenticado

listInscripciones() – inscripciones (con o sin populate)

getUsuarios() – listado de usuarios (para resolver alumnos por id)

listEstudiantesPorCurso(id) – (opcional) fallback por curso

AuthService

login() / logout()

usuario (objeto con rol) y isLoggedIn

almacenamiento de token/usuario en localStorage

Modelos (interfaces)

Usuario → { _id, nombre, correo, rol }

Curso → { _id, nombre|titulo, descripcion, profesor }

Inscripcion → { _id, curso, estudiante, fecha } (ids u objetos populados)

---

## 🛡️ Guards y Auth

AuthGuard: bloquea acceso a rutas si no hay sesión válida.

AdminGuard (opcional): restringe rutas a rol === 'admin'.

Sesión: token + usuario guardados en localStorage.

Redirección por rol en LoginComponent (profesor → /profesor/dashboard).

---

## 🎨 Estilos/UI

Angular Material (toolbar, card, button, icon, table, divider, progress, tooltip…).

Layouts responsive y tarjetas estilo “dashboard”.

## ☁️ Despliegue

Desarrollo (local)

Backend: http://localhost:3000

Frontend: npm start (proxy /api → backend)

Producción

Configurar API_BASE_URL (environments o variable de entorno).

npm run build → publicar dist/<app> en Netlify/Vercel/Hosting.

---

## 🤝 Contribuir

Haz un fork del repo del frontend.

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT.
Para detalles del backend y estructura de datos revisa el README correspondiente.
