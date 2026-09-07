# Architecture

Überblick über die technische Architektur der Urban-Golf-ScoreCard-App.
Für How-To und Setup siehe [README.md](README.md) und [CONTRIBUTING.md](CONTRIBUTING.md).

## High-Level

```
 ┌──────────────────┐   HTTPS/REST   ┌────────────────┐   pg (TCP)   ┌─────────────┐
 │  Vue 3 PWA       │ ──────────────▶│  Fastify API   │ ────────────▶│ PostgreSQL  │
 │  (Nginx static)  │                │  (Node 20)     │              │  16-alpine  │
 │   /frontend      │◀──────────────▶│   /backend     │              └─────────────┘
 └──────────────────┘   Service-     └────────────────┘
         │               Worker                 ▲
         │               Offline-Cache          │
         ▼                                      │
  localStorage ◀── Sync-Queue ──▶ Axios-Retry ──┘
```

- Frontend ist eine **SPA/PWA** — wird als Static-Bundle ausgeliefert (Nginx in Produktion, Vite-Dev-Server lokal).
- Backend ist eine schlanke Fastify-API, keine SSR, kein GraphQL — nur REST.
- Datenbank-Schema ist klein und bewusst denormalisiert für Read-Performance.

## Monorepo-Layout

```
sc.urban-golf.ch/
├── frontend/                           Vue-SPA + PWA
├── backend/                            Fastify-API
├── docker-compose.yml                  Produktions-Stack
├── docker-compose.dev.yml              Dev-Stack (mit pgAdmin, Bind-Mounts)
├── docker-compose.prod.example.yml     Beispiel für Image-basiertes Prod
├── scripts/                            DB-Import, Utility-Scripts
└── .github/workflows/                  CI/CD
```

## Frontend-Architektur

### Routing

[frontend/src/router/index.ts](frontend/src/router/index.ts) — Vue Router 5 im History-Mode.

```
/                       HomePage (Hero + Recent-Games)
/games                  GamesPage (Liste)
/games/new/:gameId?     GamesNewPage (Neu / Bearbeiten)
/games/:gameId          GamesPage (Detail mit Ranking/Horiz/Vert)
/games/:gameId/:holeId  GamesPage → GamesHoleView (Score-Entry)
/about                  AboutPage → AboutHome
/about/roadmap
/about/changelog
/feedback               FeedbackPage
```

`scrollBehavior` scrollt bei jeder Route auf `top: 0` (ausser Back/Forward: restore).

### Datenfluss

- **Composables** statt zentraler Stores für Game/Score-Daten. Siehe z.B.
  [useGamesDetailData](frontend/src/composables/useGamesDetailData.ts),
  [useGamesSummaryData](frontend/src/composables/useGamesSummaryData.ts).
- **Pinia** wird gezielt für echten geteilten State verwendet — u.a.
  [scoreWriter](frontend/src/stores/scoreWriter.ts) (Score-Schreibpfad inkl.
  Offline-Queue, Dedup).
- **API-Service** [services/api.ts](frontend/src/services/api.ts) kapselt Axios +
  Retry + Typings.

### Offline-First / Sync-Queue

```
User tippt + / – / Keypad
        │
        ▼
 scoreWriter.write()
        │
        ├─▶ vormerken (persisted via useLocalStorage)   ← passiert IMMER
        │
        └─▶ online? ─ ja ─▶ scoreWriter.flush()
                             └─▶ axios.post /api/scores  (Retry + exp. Backoff)
                                  └─ Erfolg? Eintrag weg : Eintrag bleibt liegen
```

Der Schreibpfad ist durable by construction: ein Score wird vorgemerkt, bevor
irgendetwas ans Netz geht — ein fehlgeschlagener Request (offline, Captive
Portal, 5xx, Rate-Limit) verliert ihn deshalb nie. `write()` wirft nicht.

Bei Wiederverbindung (`useOnline` aus @vueuse/core), beim Start, bei Rückkehr
aus dem Hintergrund und alle 30 s wird nachgeliefert — der Watcher dafür sitzt
im Store, nicht in einer Komponente. Dedup per (game, player, hole) — der
neueste Wert gewinnt. Aufrufer sehen nur `write()` und `flush()`.

### PWA / Service-Worker

- `vite-plugin-pwa` mit **`strategies: 'injectManifest'`** und eigener SW:
  [frontend/src/sw-custom.ts](frontend/src/sw-custom.ts).
- `registerType: 'prompt'` — Updates werden dem User als Dialog angezeigt, nie
  still durchgeführt.
- Install-Prompt via [PWAInstallBanner.vue](frontend/src/components/pwa/PWAInstallBanner.vue)
  (Android nativ via `beforeinstallprompt`, iOS manuell mit Anleitung).
- Cache-Strategie: precaching der statischen Assets + runtime-caching für API-GETs.

### Design-System "Greenway"

- **Tokens** (CSS-Custom-Properties) in [frontend/src/assets/tokens.css](frontend/src/assets/tokens.css)
  — registriert via Tailwind v4 `@theme` und als semantische Variablen
  (`--primary`, `--card-bg`, `--text-strong`) die per `.dark`-Klasse überschrieben werden.
- **Base/Komponenten-Primitive** in [frontend/src/assets/global.css](frontend/src/assets/global.css).
- **Komponenten-Bibliothek** in [frontend/src/components/ui/](frontend/src/components/ui/):
  AppButton, AppCard, AppIconButton, AppFab, AppBadge, AppBottomSheet, SegmentedControl,
  PlayerAvatar, ProgressRing.
- **Layout**: Fixed TopBar oben + BottomNav unten (auf Mobile), Desktop nutzt die
  Desktop-Nav im TopBar. HoleView blendet die BottomNav zugunsten ihrer
  eigenen Action-Bar aus.

### i18n

- [vue-i18n 11](https://vue-i18n.intlify.dev/) mit Legacy-Off.
- Locales in [frontend/src/locales/](frontend/src/locales/) — `de` ist Master.
- Sprache wird via localStorage gespeichert, Default ist Browser-Sprache → Fallback en.

### Theme

[useThemeMode.ts](frontend/src/composables/useThemeMode.ts) ist ein globaler Singleton
der eine `dark`-Klasse auf `<html>` setzt. Specificity-kritisch: `:root.dark` in
[tokens.css](frontend/src/assets/tokens.css) gewinnt gegen `:root` (sonst würden
Dark-Werte nicht greifen).

## Backend-Architektur

### Struktur

```
backend/
├── app.js                      Fastify-Bootstrap, Plugin-Registrierung, Server-Start
├── db/
│   ├── index.js                pg-Pool-Singleton
│   ├── init/schema.sql         Schema für Docker-Init (nur auf leerer DB)
│   └── migrations/             (optional) Migration-Scripts
├── routes/
│   ├── games.js                /games, /games/:id, /games/summary, …
│   ├── players.js              /players
│   ├── scores.js               /scores?game_id=… (POST upsert)
│   └── feedback.js             /feedback (Mail via Brevo/SMTP)
├── utils/
│   └── …
└── test/                       Vitest-Tests
```

### Plugins

- `@fastify/cors` — CORS mit whitelist aus `ALLOWED_ORIGINS`
- `@fastify/helmet` — Security-Header
- `@fastify/rate-limit` — Throttling pro IP
- `@fastify/compress` — gzip/brotli

### Routen-Konvention

- Alle Routes unter `/api/*`.
- Responses als JSON; Fehler als `{ error: '…' }` mit HTTP-Status.

### Datenbank-Schema

Zentrale Tabellen:

| Tabelle | Zweck |
| --- | --- |
| `players` | Spieler (id, name) |
| `games` | Spiele (id, name, created_at) |
| `game_players` | N:M Spiel ↔ Spieler |
| `scores` | Scores (game_id, player_id, hole, strokes), UNIQUE (game_id, player_id, hole) |
| `feedback` | Feedback-Submissions |

Schema-Source-of-Truth: [backend/db/init/schema.sql](backend/db/init/schema.sql).

## Test-Strategie

| Layer | Tool | Ziel |
| --- | --- | --- |
| Unit (Frontend) | Vitest + happy-dom | Composables, Utils, Stores ohne Rendering |
| Unit (Backend) | Vitest | Pure Funktionen, Validation-Helpers |
| Smoke-E2E | Playwright + Mock-API | Kritische User-Flows ohne Backend (`npm run test:e2e:smoke`) |
| Backend-Contract (geplant) | Vitest + Fastify-Inject | API-Request/Response-Contracts ohne Browser — siehe [.claude/plans/backend-contract-tests.md](.claude/plans/backend-contract-tests.md) |
| Visual-Audit | Playwright Node API | Screenshots pro Page × Theme, manuelle Review |

Siehe [frontend/TESTING.md](frontend/TESTING.md).

## Deployment

- Produktions-Container via Docker + Nginx. Details in [DEPLOYMENT.md](DEPLOYMENT.md).
- GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) baut GHCR-Images
  auf `main`-Push, sofern alle Test-Jobs grün sind.
- Reverse-Proxy (Traefik/Nginx-Proxy-Manager) wird erwartet — Compose-Files enthalten
  passende Labels.

## Konventionen & Entscheidungen

- **Monorepo statt Multirepo** — einfacher für 1–3 Maintainer, gemeinsame Lockfile reduziert Drift.
- **Fastify statt Express** — schneller, eingebaute Validation, aktiver entwickelt.
- **REST statt GraphQL** — zu klein für GQL-Overhead; OpenAPI-Spec ließe sich nachrüsten.
- **Composables statt globaler Stores** für Daten die nur auf einer Route gebraucht werden.
- **Pinia für echten globalen State** (z.B. Sync-Queue, ggf. zukünftig Auth).
- **TypeScript nur im Frontend** — Backend ist klein genug um ohne zu laufen; wird evaluiert.
- **Tailwind v4 mit @theme** statt v3 mit JavaScript-Config — moderner und typisierbarer.
