# CloudScan — Global Weather Radar Viewer

An interactive global weather radar viewer with NEXRAD/OPERA products, lightning tracking, composite imagery, and map drawing tools.

## Run & Operate

- `PORT=5000 pnpm --filter @workspace/weather-radar run dev` — run the frontend dev server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (for future backend use)

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS v4
- Maps: Leaflet + React-Leaflet
- API (backend): Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle for API server)

## Where things live

- `weather-radar/` — Main frontend React app (Vite, Tailwind, Leaflet)
- `weather-radar/src/` — App source (pages, components, hooks, lib)
- `artifacts/api-server/` — Express 5 backend (health check, future API)
- `artifacts/mockup-sandbox/` — Vite component dev sandbox
- `lib/db/` — Drizzle ORM schema and migrations
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod schemas

## Architecture decisions

- `weather-radar` package lives at root level; added explicitly to `pnpm-workspace.yaml` alongside `apps/*`, `artifacts/*`, `lib/*`
- In dev, Vite proxies `/api/nexrad-l3`, `/api/meteogate`, `/api/openradar` to external S3/weather APIs to bypass CORS
- Production on Replit uses `weather-radar/server.mjs` (Express + static files + same API proxies); build with `VITE_USE_API_PROXY=true`
- GitHub Pages static build deploys from `weather-radar/dist/public` (no API proxy — some sources may block browser CORS)
- `PORT=5000` must be set when running the dev server (vite reads `process.env.PORT`)
- `allowedHosts: true` and `host: "0.0.0.0"` are already configured in `vite.config.ts` for Replit proxy compatibility

## Product

- Global composite radar imagery (RainViewer)
- NEXRAD Level-3 radar station viewer (US)
- OPERA radar viewer (Europe)
- Lightning strike tracking
- Satellite imagery overlay
- Map drawing tools
- Animated radar playback with timeline controls

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `PORT=5000` env var must be passed — vite.config.ts reads it and throws if invalid
- `weather-radar` is not under `apps/` on disk; it's at the workspace root and listed explicitly in `pnpm-workspace.yaml`
- pnpm `minimumReleaseAge: 1440` is enforced — don't install packages published less than 1 day ago (except `@replit/*`)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
