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

   Para el Postgres de Docker: `DATABASE_URL=postgres://nightdaro:nightdaro@localhost:5432/nightdaro`.

3. Levantar Postgres 16:

   ```bash
   docker compose up -d
   ```

4. Iniciar el servidor de desarrollo y abrir http://localhost:3000:

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
