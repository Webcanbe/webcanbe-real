# Webcanbe

Webcanbe is a source-first marketplace and browser workspace for real web projects.

## Production stack

- Frontend: React 19 + TypeScript
- Build: Vite 6
- Hosting: Cloudflare Workers + Static Assets
- Authentication:
  - Google OAuth Authorization Code + PKCE through the Worker
  - GitHub and Email/Password through Firebase Authentication
  - first-party Webcanbe session boundary
- Database: PostgreSQL
- Production database: Supabase
- Cloudflare database path: Hyperdrive (prepared; final binding pending)
- Production branch: `main`
- Production domain: `https://webcanbe.com`

## Local development

```bash
npm ci
npm run dev
```

Production build:

```bash
npm run build
```

Cloudflare production deploy:

```bash
npm run deploy:cloudflare
```

## Main directories

- `src/` — React app, product client, editor/runtime code
- `worker/` — Cloudflare Worker auth and product API adapters
- `public/wcb-landing/` — retained self-hosted landing document/assets
- `deployment/hosted/` — PostgreSQL schema and deployment material
- `docs/phase5.md` — current launch plan and checklist
- `docs/current-handoff.md` — latest implementation checkpoint
- `docs/project-record.md` — architectural project history

## Frontend Firebase build variables

The Vite build expects these variables. Values belong in the deployment environment, not source control.

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

GitHub OAuth Client ID/Secret are configured in Firebase and are not frontend/Cloudflare variables.

## Server-only configuration

Google OAuth and database credentials are server-only. Do not commit OAuth client secrets, database passwords, Hyperdrive origin credentials, or payment-provider secrets.

The PostgreSQL Webcanbe schema is intentionally server-authoritative. Supabase `anon` and `authenticated` roles have no privileges on `wcb_*` tables/functions.

## Phase 5

The approved dashboard UI is frozen. Current implementation work is focused on production identity, persisted product APIs, PostgreSQL/Hyperdrive, marketplace purchase/entitlement flows, editor persistence, seller pipeline connection, and launch hardening.

See `docs/phase5.md` for the active sequence.
