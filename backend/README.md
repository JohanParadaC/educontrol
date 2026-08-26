# educontrol-backend

**Sistema de gestión de cursos, estudiantes y profesores**  
Backend RESTful construido con Node.js, Express y MongoDB/Mongoose.

---

## 📋 Tabla de contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Prerequisitos](#prerequisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Scripts disponibles](#scripts-disponibles)
- [Modelos de datos](#modelos-de-datos)
- [Rutas de la API](#rutas-de-la-api)
- [Middlewares](#middlewares)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

---

## 📝 Descripción

Este proyecto implementa un backend para gestionar usuarios (estudiantes/profesores), cursos e inscripciones.  
Permite:

- Autenticación y renovación de tokens JWT.
- CRUD completo de usuarios y cursos (con control de roles).
- Inscripción de estudiantes en cursos (sin duplicados).
- Purga de la base de datos (para entornos de desarrollo).

---

## ⚙️ Características

- **Node.js** v18+ con **Express.js**
- **MongoDB** + **Mongoose** (relaciones `populate`, índices compuestos)
- Validaciones con **express-validator**
- Autenticación JWT con **jsonwebtoken**
- Hash de contraseñas con **bcryptjs**
- **CORS** habilitado
- Manejo centralizado de errores

---

## 📦 Prerequisitos

- **Node.js** v18 o superior
- **npm** o **yarn**
- **MongoDB** (local o Atlas)

---

## 🚀 Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/JohanParadaC/educontrol-backend.git
cd educontrol-backend

# 2. Instalar dependencias
npm install
```

---

## 🔧 Configuración

1. Copia el ejemplo de variables de entorno:
   ```bash
   cp .env.example .env
   ```
2. Abre tu `.env` y completa con tus datos:
   ```env
   PORT=3000
   MONGO_URI=mongodb+srv://<usuario>:<password>@cluster0.mongodb.net/educontrol
   JWT_SECRET=unaClaveSecretaMuySegura
   ```

---

## 🗂️ Estructura del proyecto

```text
educontrol-backend/
├── config/
│   └── db.js                 # Conexión y configuración de Mongoose
├── controllers/
│   ├── auth.controller.js
│   ├── usuarios.controller.js
│   ├── cursos.controller.js
│   └── inscripciones.controller.js
├── middlewares/
│   ├── auth.js               # Verifica JWT
│   ├── roleCheck.js          # Comprueba roles
│   ├── validateFields.js     # Captura errores de express-validator
│   └── errorHandler.js       # Manejador central de errores
├── models/
│   ├── Usuario.js
│   ├── Curso.js
│   └── Inscripcion.js
├── routes/
│   ├── auth.routes.js
│   ├── usuarios.routes.js
│   ├── cursos.routes.js
│   ├── inscripciones.routes.js
│   └── admin.routes.js       # Rutas de purga en desarrollo
├── utils/
│   └── generarJWT.js         # Helper para crear tokens
├── .env.example
├── .gitignore
├── app.js                    # Punto de entrada
├── package.json
└── README.md
```

---

## ⚡ Scripts disponibles

| Comando       | Descripción                             |
| ------------- | --------------------------------------- |
| `npm run dev` | Inicia el servidor con **nodemon**      |
| `npm start`   | Inicia el servidor con **node**         |
| `npm test`    | Ejecuta tests (pendiente de configurar) |

---

## 📊 Modelos de datos

### Usuario

| Campo        | Tipo   | Descripción                                        |
| ------------ | ------ | -------------------------------------------------- |
| `nombre`     | String | Nombre completo (requerido)                        |
| `correo`     | String | Email único con validación (requerido)             |
| `contraseña` | String | Hasheada con bcryptjs (requerido)                  |
| `rol`        | String | Enum(`estudiante`, `profesor`,`admin`) (requerido) |

### Curso

| Campo         | Tipo               | Descripción                        |
| ------------- | ------------------ | ---------------------------------- |
| `nombre`      | String             | Título del curso (requerido)       |
| `descripcion` | String             | Detalles del curso (opcional)      |
| `profesor`    | ObjectId → Usuario | Referencia al profesor (requerido) |

### Inscripción

| Campo        | Tipo               | Descripción                             |
| ------------ | ------------------ | --------------------------------------- |
| `estudiante` | ObjectId → Usuario | Referencia al estudiante (requerido)    |
| `curso`      | ObjectId → Curso   | Referencia al curso (requerido)         |
| `fecha`      | Date               | Fecha de inscripción (por defecto: now) |

---

## 🔗 Rutas de la API

Todas las rutas van bajo el prefijo `/api`.

### Auth

| Método | Ruta              | Descripción                           |
| ------ | ----------------- | ------------------------------------- |
| POST   | `/api/auth/login` | Login. Body: `{ correo, password }`   |
| GET    | `/api/auth/renew` | Renovar JWT. Header: `x-token: <JWT>` |

### Usuarios

| Método | Ruta                | Descripción            | Roles        |
| ------ | ------------------- | ---------------------- | ------------ |
| GET    | `/api/usuarios`     | Listar usuarios        | —            |
| GET    | `/api/usuarios/:id` | Obtener usuario por ID | —            |
| POST   | `/api/usuarios`     | Crear usuario          | —            |
| PUT    | `/api/usuarios/:id` | Actualizar usuario     | —            |
| DELETE | `/api/usuarios/:id` | Borrar usuario         | Sólo `admin` |

### Cursos

| Método | Ruta              | Descripción          | Roles               |
| ------ | ----------------- | -------------------- | ------------------- |
| GET    | `/api/cursos`     | Listar cursos        | —                   |
| GET    | `/api/cursos/:id` | Obtener curso por ID | —                   |
| POST   | `/api/cursos`     | Crear curso          | `profesor`, `admin` |
| PUT    | `/api/cursos/:id` | Actualizar curso     | `profesor`, `admin` |
| DELETE | `/api/cursos/:id` | Borrar curso         | `profesor`, `admin` |

### Inscripciones

| Método | Ruta                     | Descripción                | Roles        |
| ------ | ------------------------ | -------------------------- | ------------ |
| GET    | `/api/inscripciones`     | Listar inscripciones       | —            |
| GET    | `/api/inscripciones/:id` | Obtener inscripción por ID | —            |
| POST   | `/api/inscripciones`     | Inscribir estudiante       | —            |
| PUT    | `/api/inscripciones/:id` | Actualizar inscripción     | —            |
| DELETE | `/api/inscripciones/:id` | Eliminar inscripción       | Sólo `admin` |

### Admin (desarrollo)

| Método | Ruta               | Descripción                       |
| ------ | ------------------ | --------------------------------- |
| DELETE | `/api/admin/purge` | Purga toda la base de datos (Dev) |

---

## 🛡️ Middlewares

- **`auth.js`** (`validateJWT`): Verifica y decodifica el JWT enviado en `x-token`.
- **`validateFields.js`**: Comprueba errores de validación de `express-validator`.
- **`roleCheck.js`** (`roleCheck(...roles)`): Restringe acceso según rol de usuario.
- **`errorHandler.js`**: Captura errores y devuelve un JSON estandarizado.

---

## 🤝 Contribuir

1. Haz un **fork** de este repositorio.
2. Crea una rama en tu fork:
   ```bash
   git checkout -b desarrollo
   ```
3. Realiza tus cambios y haz **commit**:
   ```bash
   git commit -m "feat: descripción de tu cambio"
   ```
4. Empuja tu rama:
   ```bash
   git push origin desarrollo
   ```
5. Abre un **Pull Request** contra la rama `desarrollo` de este repositorio.

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**.  
Consulta el archivo [LICENSE](../LICENSE) de la raíz para más detalles.
