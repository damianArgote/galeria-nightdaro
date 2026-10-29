# Galería NightDaro

Galería pública y panel de administración de NightDaro en una sola app Next.js 15. La arquitectura está en [docs/arquitectura.md](docs/arquitectura.md).

## Requisitos

- Node.js 22
- pnpm 11
- Docker (para el Postgres local)

## Levantar el proyecto en local

1. Instalar dependencias:

   ```bash
   pnpm install
   ```

2. Crear el archivo de variables y completar los valores:

   ```bash
   cp .env.example .env.local
   ```

   Para el Postgres de Docker: `DATABASE_URL=postgres://nightdaro:nightdaro@localhost:5433/nightdaro`. El puerto local es 5433 para no chocar con otro Postgres en 5432; se cambia con `POSTGRES_PORT` (por ejemplo `POSTGRES_PORT=5434 docker compose up -d`).

3. Levantar Postgres 16:

   ```bash
   docker compose up -d
   ```

4. Crear las tablas y cargar los datos iniciales (completar antes `SEED_DARO_*` y `SEED_DAMI_*` en `.env.local`):

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

   El seed crea la configuración del sitio de NightDaro, tres tiers de Patreon de ejemplo y los dos usuarios admin con contraseñas hasheadas con argon2id. Se puede correr varias veces: no duplica ni pisa filas existentes.

5. Iniciar el servidor de desarrollo y abrir http://localhost:3000:

   ```bash
   pnpm dev
   ```

## Scripts

| Script           | Qué hace                                                        |
| ---------------- | --------------------------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo                                          |
| `pnpm build`     | Build de producción                                             |
| `pnpm start`     | Sirve el build de producción                                    |
| `pnpm lint`      | ESLint, incluida la regla de capas de `src/core`                |
| `pnpm typecheck` | TypeScript sin emitir archivos                                  |
| `pnpm test`      | Vitest                                                          |
| `pnpm format`    | Prettier sobre todo el repo (`pnpm format:check` solo verifica) |

## Estructura

| Carpeta          | Contenido                                            |
| ---------------- | ---------------------------------------------------- |
| `src/app`        | Rutas de Next.js (galería, `/admin`, route handlers) |
| `src/core`       | Entidades, casos de uso y puertos en TypeScript puro |
| `src/infra`      | Adaptadores (Drizzle, Bunny, sharp) y `container.ts` |
| `src/db`         | Schema, migraciones y seed de Drizzle                |
| `src/components` | Componentes de UI (`ui/` es shadcn/ui)               |

`src/core` no puede importar `next`, `react` ni `drizzle-orm`: ESLint falla si lo hace. Los colores de marca son tokens en `src/app/globals.css` (`brand-violet`, `brand-sky`, `brand-green`, `brand-indigo`), mapeados a los tokens de shadcn/ui (`primary`, `secondary`, `accent`, `background`).

## Tests de integración

Los archivos `*.integration.test.ts` corren contra Postgres. Cada suite crea y migra su propia base `<db>_test_<nombre>` en el mismo servidor, así nunca tocan los datos de desarrollo. Con Docker levantado y `DATABASE_URL` en `.env.local`, `pnpm test` los corre; en CI usan el servicio Postgres 16 del workflow.
