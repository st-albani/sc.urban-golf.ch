# Frontend — Urban Golf ScoreCard

Die Vue 3 PWA der ScoreCard-App. Dieser Guide fokussiert auf Dev-Workflow.
Für Architektur siehe [../ARCHITECTURE.md](../ARCHITECTURE.md), für Tests
[TESTING.md](TESTING.md), für Design-Regeln
[../.claude/skills/ui-tokens/SKILL.md](../.claude/skills/ui-tokens/SKILL.md).

## Quick Start

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

Backend muss separat laufen (siehe [../backend/README.md](../backend/README.md))
oder `VITE_API_BASEURL` zeigt auf einen entfernten API-Endpoint.

## Tech Stack

| Bereich | Version |
| --- | --- |
| Vue | 3.4 (Composition API, `<script setup lang="ts">`) |
| Build | Vite 8 mit `@vitejs/plugin-vue` |
| Routing | vue-router 5 (History-Mode) |
| State | Pinia 3 (nur für echten globalen State) |
| i18n | vue-i18n 11 (Legacy off) |
| Styling | Tailwind v4 (`@theme`-Direktive) + eigene Tokens |
| Icons | @heroicons/vue 2 |
| HTTP | Axios 1 mit Retry |
| PWA | vite-plugin-pwa 1 mit `injectManifest` + eigenem SW |
| Tests | Vitest 4 + Playwright 1.59 |

## Projektstruktur

```
frontend/
├── index.html                       lädt Inter Variable Font + mountet #app
├── vite.config.js                   Dev-Proxy /api → :3000, PWA-Plugin, Compression
├── tailwind.config.js               Safelist für dynamische Klassen
├── tsconfig.json
├── src/
│   ├── main.ts                      Pinia + Router + i18n + Axios + SW-Register
│   ├── App.vue                      BackgroundImage + RouterView + Toasts + PWA-Dialoge
│   ├── router/index.ts              Alle Routen + scrollBehavior
│   ├── layouts/DefaultLayout.vue    TopBar + Main + BottomNav
│   ├── pages/
│   │   ├── home/HomePage.vue
│   │   ├── games/GamesPage.vue
│   │   ├── games/GamesNewPage.vue
│   │   ├── feedback/FeedbackPage.vue
│   │   └── about/AboutPage.vue (+ AboutHome, Roadmap, ChangeLog)
│   ├── components/
│   │   ├── layout/                  TopBar, BottomNav, SettingsSheet
│   │   ├── ui/                      AppButton, AppCard, AppFab, AppBottomSheet,
│   │   │                            SegmentedControl, PlayerAvatar, ProgressRing, …
│   │   ├── games/                   GamesList*, GamesDetail* (Ranking/Horiz/Vert), GamesHoleView
│   │   ├── about/                   AboutHome, Roadmap (Timeline), ChangeLog
│   │   └── pwa/                     PWAInstallBanner, PWAUpdateDialog
│   ├── composables/                 useGamesDetailData, useSortedPlayers, useOfflineSync,
│   │                                useThemeMode, usePlayerColors, useViewMode, …
│   ├── stores/scoreWriter.ts        Score-Schreibpfad: write/flush, Offline-Queue,
│   │                                Dedup, Reconnect (Pinia + useLocalStorage)
│   ├── services/api.ts              HTTP-Client mit Retry
│   ├── locales/{de,en,fr,nl}.json   i18n
│   ├── assets/tokens.css            Design-Tokens (Tailwind @theme + semantische Vars)
│   ├── assets/global.css            Base + Komponenten-Primitive + Animationen
│   └── sw-custom.ts                 Custom Service-Worker (injectManifest)
├── e2e/
│   ├── smoke/                       Mock-basierte Smoke-Suite (kein Backend)
│   ├── tests/                       Integration-Suite (braucht Backend + DB)
│   ├── pages/                       Page-Objects für Integration-Tests
│   └── visual-audit.mjs             Screenshot-Script pro Page × Theme
├── playwright.config.ts             Integration-Config (baseURL default 8080)
├── playwright.smoke.config.ts       Smoke-Config (Dev-Server auf 5173)
└── TESTING.md                       Test-Übersicht
```

## Environments / Config

Vite lädt `.env*` Dateien aus dem Frontend-Root. Nur Variablen mit `VITE_`-Prefix
werden in den Client gebundled.

| Datei | Zweck |
| --- | --- |
| `.env.development` | Dev-Server-Defaults |
| `.env.test` | Test-Build (`npm run build:test`) |
| `.env.production` | Prod-Build (`npm run build` / `build:prod`) |
| `.env.example` | Template, ins Repo committet |

Wichtige Variablen:
- `VITE_API_BASEURL=/api` — Pfad zur API, in dev durch `vite.config.js` → Port 3000 proxied

## NPM Scripts

| Script | Zweck |
| --- | --- |
| `npm run dev` | Vite Dev-Server, HMR, Proxy auf Backend |
| `npm run build` | Prod-Bundle nach `dist/` |
| `npm run build:test` | Bundle gegen Test-/Staging-Env |
| `npm run preview` | Prod-Build lokal previewen |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint --fix |
| `npm run type-check` | `vue-tsc --noEmit` |
| `npm test` | Vitest Unit-Tests |
| `npm run test:watch` | Vitest Watch-Mode |
| `npm run test:e2e` | Playwright Integration-Suite (Backend erforderlich) |
| `npm run test:e2e:smoke` | Playwright Smoke-Suite mit Mock-API |
| `npm run test:e2e:smoke:headed` | Smoke mit sichtbarem Browser |
| `npm run test:visual` | Screenshot-Audit (16 PNGs für Review) |
| `npm run test:all` | Lint + Type-Check + Unit + Smoke in einer Kette |

## Design System — "Greenway"

Alle UI-Entscheidungen referenzieren das Token-System. Konsultiere unbedingt
[../.claude/skills/ui-tokens/SKILL.md](../.claude/skills/ui-tokens/SKILL.md)
bevor du Farben, Spacing oder Typo anfasst.

- **Tokens**: [src/assets/tokens.css](src/assets/tokens.css) — OKLCH-Farben,
  Typo-Scale mit `clamp()`, Radii, Shadows, Motion-Easings. Tailwind-Utilities
  werden via `@theme`-Direktive abgeleitet (`bg-brand-500`, `text-display`, …).
- **Semantische Variablen** (`--primary`, `--card-bg`, `--text-strong`) in
  `:root` (light) und `:root.dark` (dark) — Specificity `:root.dark` schlägt
  `:root` bewusst.
- **Komponenten-Primitive**: [src/components/ui/](src/components/ui/) — bevorzugt
  verwenden statt neue Einzellösungen.
- **Animationen**: GPU-accelerated (transform / opacity / background-position),
  `prefers-reduced-motion` wird global in global.css respektiert.

## State / Daten

- **Pinia** nur für echten globalen State. U.a. `scoreWriter` — der einzige
  Schreibpfad für Scores (`write()` / `flush()`); Queue, Netzstatus und
  Reconnect-Handling liegen dahinter.
- Daten die zu einer Route gehören → **Composable + Provide/Inject**. Siehe
  `useGamesDetailData` + `gamesDetailKey` in [src/types/index.ts](src/types/index.ts).
- **API** über [src/services/api.ts](src/services/api.ts) — Axios mit exponential
  backoff (2 Retries) und globalen Toast-Fehlern via Interceptor.

## Testing

Siehe [TESTING.md](TESTING.md) für die vollständige Teststrategie. Kurzfassung:

- `npm run test:all` läuft ohne Backend in ~15 s.
- Smoke-Suite mockt die API (siehe [e2e/smoke/mock-api.ts](e2e/smoke/mock-api.ts))
- Integration-Suite braucht laufendes Backend + PostgreSQL.

## Troubleshooting

- **Vite-Port belegt**: `npm run dev -- --port 5175`
- **Tailwind nicht angewendet**: Prüfe `@import "tailwindcss";` in
  [src/assets/global.css](src/assets/global.css) und `@tailwindcss/vite`-Plugin in `vite.config.js`.
- **Dark-Mode greift nicht**: `:root.dark`-Specificity in tokens.css prüfen —
  `:where(.dark)` gewinnt NICHT gegen `:root`.
- **PWA-Cache-Stale**: im DevTools → Application → Service Workers → Unregister,
  dann Hard-Reload. Oder in der App den Update-Dialog abwarten.
- **Playwright-Browser fehlen**: `npx playwright install chromium`

## Weiterlesen

- [../README.md](../README.md) — Repo-Übersicht
- [../ARCHITECTURE.md](../ARCHITECTURE.md) — technische Tiefen
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — PR-Workflow
- [TESTING.md](TESTING.md) — Test-Pipeline
