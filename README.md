# Disprova GyG — Sistema DISPORVA

Monorepo inicial para pedidos, inventario y cobranza (distribución).

## Stack

- **Backend:** Node.js, Express, TypeScript, PostgreSQL (`pg`, Prisma ORM)
- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Infra:** Docker Compose (PostgreSQL 16 + backend con hot-reload)

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o Docker Engine + Compose)
- Node.js 20+ (solo para el frontend en desarrollo local)

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
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).

## Base de datos (Prisma)

Con PostgreSQL en marcha (`docker compose up -d postgres`):

```bash
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npx prisma studio
```

Datos de prueba del seed: roles `admin` y `vendedor`, usuario `admin@disprova.local` / `Admin123!`, 3 categorías (con jerarquía), 5 productos, 8 presentaciones y lista **Lista general** con un precio por presentación.

`DATABASE_URL` en `backend/.env` debe apuntar a `localhost:5432` cuando ejecutas Prisma desde tu máquina.

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

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `docker compose up` | Servicios en primer plano |
| `docker compose up -d` | Servicios en segundo plano |
| `docker compose down` | Detener contenedores |
| `docker compose down -v` | Detener y borrar volumen de Postgres |
