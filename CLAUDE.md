# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development (from repo root)
```bash
npm run dev          # Run server + client concurrently
npm run dev:server   # Server only (tsx watch, port 3001)
npm run dev:client   # Client only (Vite, port 5173)
```

### Database (run from `server/`)
```bash
npx prisma db push       # Apply schema changes to SQLite (use this, NOT migrate dev)
npx prisma generate      # Regenerate Prisma client after schema changes
npx tsx prisma/seed.ts   # Reseed — DESTRUCTIVE, wipes all data
```
Always run both `db push` AND `generate` after editing `schema.prisma`. The IDE may show stale type errors until `generate` finishes.

### Type checking
```bash
cd client && ./node_modules/.bin/tsc --noEmit   # Client
cd server && ./node_modules/.bin/tsc --noEmit   # Server
```

### First-time setup
```bash
npm run setup   # install:all + db:generate + db:push + seed
```

### Environment
Copy `server/.env.example` → `server/.env`. Required vars: `DATABASE_URL`, `JWT_SECRET`, `UPLOAD_DIR`. Azure/SharePoint vars are optional (contractor sync feature).

## Architecture

**Monorepo** with three `package.json` files: root (concurrently only), `server/`, `client/`.

### Backend — `server/`
- **Express** + **Prisma** (SQLite). Single `prisma` client instance exported from `src/index.ts`.
- All routes under `src/routes/`, mounted at `/api/<resource>` in `index.ts`.
- Auth: JWT via `Authorization: Bearer <token>` header. Middleware in `src/middleware/auth.ts` provides `authenticateToken` and `requireRole(...roles)`.
- File uploads via **multer**; served statically at `/uploads`.
- In production, Express also serves the React SPA from `public/` (built client dist).

### Frontend — `client/`
- **React 19** + **Vite** + **TypeScript** + **Tailwind CSS v4**.
- State: **Zustand** (`authStore`, `projectStore`). Server state: **TanStack Query**.
- API client: `src/lib/api.ts` — axios instance with base `/api`, auto-attaches JWT, redirects to `/login` on 401/403.
- Routes: `/` → RegistrarBitacoraPage, `/bitacoras` → VerBitacorasPage, `/bitacoras/:id` → DetalleBitacoraPage, `/configuracion` → ConfiguracionPage (admin-only).

### Key global flags
- **`SINGLE_PROJECT_MODE = true`** in `client/src/stores/projectStore.ts` — locks the app to the "Baia Kristal" project and hides multi-project UI. Set `DEFAULT_PROJECT_NAME` to change the active project name.

## Domain model

### Roles (`tipoUsuario`)
| Value | Capabilities |
|---|---|
| `residente_obra` | Create/draft bitácoras for assigned torres |
| `director_obra` | Sign as director, edit activities before signing |
| `director_obra_general` | Same as director + can sign as interventor |
| `interventoria` | Sign as interventor |
| `admin` | Full access, configuration, delete bitácoras |

### Folio system
Each `Torre` has `folioActual` (last assigned folio) and a `FolioControl` table (one row per torre+date). On new bitácora creation:
1. `/folios/siguiente` previews the next folio (used in the registration UI).
2. When no `FolioControl` records exist, the first folio is `torre.folioActual + 1` — this is how "primer folio digital" is configured via the Frentes form.
3. On delete, the `FolioControl` row is removed and `torre.folioActual` is resynced to the latest remaining entry.

### Bitácora signing flow
Three sequential signature slots — each stores JSON (`nombre/email/cedula/cargo`) + timestamp:
1. `firma-residente` — resident signs; can be skipped via `omitirFirmaResidente`
2. `firma-director` — requires `comentariosDirector` (non-empty) before signing
3. `firma-interventor` — requires `comentariosInterventor`; can be signed by `interventoria` OR `director_obra_general`

`estadoDiligencia` is recalculated after each signature: `nuevo → pendiente_director/interventor/ambos → completado`.

### Torre ("Frente") naming
`nombre` is always auto-computed as `etapaConstructiva + ' - ' + frente` (both stored uppercase). Do not allow free-text `nombre` input — generate it from the two fields.

### Draft system
Bitácora registration drafts are stored in `localStorage` under key `borrador_bitacora_{torreId}_{fecha}`. File objects (photos) are stripped from drafts. Drafts auto-load when a frente is selected and a draft exists for that day.

## Schema change workflow
1. Edit `server/prisma/schema.prisma`
2. `cd server && npx prisma db push`
3. `cd server && npx prisma generate`
4. Update the corresponding route to read/write the new field
5. The IDE error "does not exist in type" after step 1 is expected — it clears after step 3
