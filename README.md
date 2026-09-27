# Disprova GyG — Sistema DISPORVA

Monorepo inicial para pedidos, inventario y cobranza (distribución).

## Stack

- **Backend:** Node.js, Express, TypeScript, PostgreSQL (`pg`, Prisma ORM)
- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Infra:** Docker Compose (PostgreSQL 16 + backend con hot-reload)

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o Docker Engine + Compose)
- Node.js 20+ y pnpm (solo para el frontend en desarrollo local)
- El backend dentro de Docker usa pnpm vía `corepack`; en tu máquina podés
  activarlo igual con `corepack enable`

## Primer arranque

1. Copia las variables de entorno del backend:

   ```bash
   cp backend/.env.example backend/.env
   ```

   Ajusta `POSTGRES_PASSWORD` en `backend/.env` para que coincida con la contraseña que uses en `docker-compose.yml` (por defecto en desarrollo: `disprova_dev_password`).

2. Levanta PostgreSQL y el backend:

   ```bash
   docker compose up --build
   ```

   La primera vez construye la imagen del backend e instala dependencias dentro del contenedor.

3. Verifica el health check:

   ```bash
   curl http://localhost:3000/health
   ```

   Respuesta esperada (HTTP 200):

   ```json
   { "status": "ok", "database": "connected" }
   ```

## Frontend (fuera de Docker)

```bash
cd frontend
pnpm install
pnpm dev
```

Abre [http://localhost:5173](http://localhost:5173).

## Base de datos (Prisma)

Con PostgreSQL en marcha (`docker compose up -d postgres`):

```bash
cd backend
pnpm install
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm exec prisma studio
```

Datos de prueba del seed: roles `admin` y `vendedor`, usuario `admin@disprova.local` / `Admin123!`, 3 categorías (con jerarquía), 5 productos, 8 presentaciones y lista **Lista general** con un precio por presentación.

`DATABASE_URL` en `backend/.env` debe apuntar a `localhost:5432` cuando ejecutas Prisma desde tu máquina.

## Variables de entorno

El backend lee todo desde `backend/.env` (copiado de `backend/.env.example`).
La imagen de Docker la carga con `env_file` y sobreescribe los valores de
PostgreSQL con los del servicio `postgres`.

### Base y servidor

| Variable | Qué es |
|----------|--------|
| `NODE_ENV` | Modo de ejecución: `development`, `production` o `test`. |
| `PORT` | Puerto HTTP del servidor Express (3000 por defecto). |

### PostgreSQL

| Variable | Qué es |
|----------|--------|
| `POSTGRES_HOST` | Host de PostgreSQL: `postgres` dentro de Docker, `localhost` desde tu máquina. |
| `POSTGRES_PORT` | Puerto de PostgreSQL (5432). |
| `POSTGRES_USER` | Usuario de la base de datos. |
| `POSTGRES_PASSWORD` | Contraseña del usuario; debe coincidir con la de `docker-compose.yml`. |
| `POSTGRES_DB` | Nombre de la base de datos. |
| `DATABASE_URL` | Cadena de conexión que usa Prisma. |

### Autenticación

| Variable | Qué es |
|----------|--------|
| `JWT_ACCESS_SECRET` | Secreto para firmar los tokens de acceso (caducan a los 15 minutos). |
| `JWT_REFRESH_SECRET` | Secreto para firmar los tokens de refresco. |

### Próximos módulos — no configurado aún

Estas variables todavía no existen en el código: se agregarán a
`backend/.env.example` en sus tickets correspondientes. Dejalas vacías por
ahora; el backend no las lee hasta que se implemente cada módulo.

| Variable | Qué es | Estado |
|----------|--------|--------|
| `WHATSAPP_PROVIDER` | Proveedor de mensajería (DISP-014). | No configurado aún |
| `WHATSAPP_TOKEN` | Token de acceso de la API de WhatsApp (DISP-014). | No configurado aún |
| `WHATSAPP_PHONE_NUMBER_ID` | Identificador del número emisor en WhatsApp Cloud API (DISP-014). | No configurado aún |
| `FEL_PROVIDER_API_KEY` | Credencial del proveedor de facturación electrónica (DISP-018). | No configurado aún |

## Estructura

```
backend/prisma   # schema, migraciones, seed
backend/src
  config/       # entorno y conexión a PostgreSQL
  modules/      # dominios de negocio (vacío)
  middlewares/
  shared/       # errores, utilidades (p. ej. formato de dinero)

frontend/src
  features/admin, field, store
  shared/
```

## Documentación de la API

Un solo Swagger para todo el backend (es un monolito, no hay servicios separados):

- **UI:** http://localhost:3000/api/docs
- **Spec en JSON:** http://localhost:3000/api/docs.json

Ambos son públicos a propósito: es documentación, no datos. La spec se arma con
`swagger-jsdoc` leyendo comentarios `#swagger` que están arriba de las rutas, en el
archivo de rutas de cada módulo, y se configuran en `backend/src/docs/openapi.ts`.

## Estado de las integraciones externas

| Integración | Estado | Qué falta |
|---|---|---|
| WhatsApp (enlaces wa.me) | Activo, no requiere configuración | — |
| WhatsApp Business API | Apagado por defecto | `WHATSAPP_PROVIDER=business_api` + `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` |
| Facturación FEL | No implementado (stub) | Elegir certificador y programar su integración |

Los dos proveedores usan el mismo patrón: una interfaz, una implementación por
integración y **una sola función factory** que decide cuál usar según una variable
de entorno. Activar uno no requiere tocar el resto del sistema.

`/api/messaging/clients/:id/send` responde **422** mientras el proveedor siga en
`wa_link`, porque ese modo no envía desde el servidor: el flujo de trabajo hoy es
que el administrador use el link. Las facturas quedan en
`pendiente_certificacion` hasta que se elija un certificador, y eso tampoco es un
error.

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `docker compose up` | Servicios en primer plano |
| `docker compose up -d` | Servicios en segundo plano |
| `docker compose down` | Detener contenedores |
| `docker compose down -v` | Detener y borrar volumen de Postgres |
| `docker compose build` | Reconstruir las imágenes (backend con pnpm) |
| `cd backend && pnpm dev` | Backend con recarga en caliente |
| `cd backend && pnpm test` | Tests del backend (Vitest) |
| `cd backend && pnpm exec prisma studio` | Explorar la base de datos |
| `cd frontend && pnpm dev` | Frontend en desarrollo |
