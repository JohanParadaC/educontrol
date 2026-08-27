# Dockerfile
# ---------------------------------------------------------------------------
# Imagen de producción de EduControl: un solo proceso que sirve la API y la
# SPA desde el mismo origen, que es la arquitectura del proyecto.
#
# Tres etapas, y cada una existe por una razón concreta:
#
#   1. `frontend` construye el bundle de Angular. Necesita todas sus
#      devDependencies —el compilador es una de ellas—, y ninguna de ellas
#      tiene por qué acabar en la imagen final.
#   2. `dependencias` instala SOLO las de producción del backend. Aquí no se
#      copia el código: si únicamente cambia un controlador, esta capa se
#      reutiliza tal cual y no se vuelve a instalar nada.
#   3. `produccion` junta el bundle y el backend sobre una base limpia.
#
# El resultado no lleva compilador de Angular, ni Jest, ni Playwright, ni
# swagger-ui: la documentación de la API es una devDependency a propósito y por
# eso aquí no está — /api/docs simplemente no se monta.
# ---------------------------------------------------------------------------

# --- 1) Build del frontend -------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /app/frontend

# Primero los manifiestos: mientras no cambien, npm ci no se repite.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- 2) Dependencias de producción del backend -----------------------------
FROM node:22-alpine AS dependencias
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
# --omit=dev deja fuera Jest, supertest, nodemon, mongodb-memory-server (que se
# baja un mongod entero) y swagger-ui. `npm ci` respeta el lockfile: la imagen
# lleva exactamente las versiones que se han probado.
RUN npm ci --omit=dev && npm cache clean --force

# --- 3) Imagen final -------------------------------------------------------
FROM node:22-alpine AS produccion

# dumb-init como PID 1. Node no se comporta como init: no adopta huérfanos y,
# sobre todo, un proceso con PID 1 no recibe las señales por defecto — sin
# esto, el SIGTERM del `docker stop` no llegaría al apagado ordenado y el
# contenedor moriría a los 10 s de SIGKILL, cortando lo que estuviera sirviendo.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=3000
# static.js sirve la SPA desde aquí; en el repositorio está en frontend/dist.
ENV FRONTEND_DIST=/app/frontend

WORKDIR /app

# `--chown` en el COPY y no un `chown -R` después: un chown sobre una capa ya
# escrita duplica todos los ficheros en la imagen.
COPY --chown=node:node --from=dependencias /app/backend/node_modules ./backend/node_modules
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node --from=frontend /app/frontend/dist/educontrol-frontend/browser ./frontend

# La imagen de Node ya trae un usuario `node` sin privilegios. Correr como root
# dentro del contenedor no aporta nada y convierte cualquier fallo de la
# aplicación en un fallo con permisos de root.
USER node

EXPOSE 3000

# Se sondea /ready y no /live: lo que le interesa saber a Docker es si esto
# puede atender peticiones, no solo si el proceso respira. Sin curl ni wget en
# la imagen —no están en alpine— se usa el fetch que ya trae Node 22.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/server.js"]
