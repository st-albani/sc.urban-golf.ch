# CLAUDE.md — Guide für Claude Code / LLM-Agenten

Diese Datei hilft Claude Code (und allen anderen LLM-Agenten) schnell produktiv im
Urban-Golf-ScoreCard-Repo zu arbeiten. Sie wird als Kontext gelesen wenn jemand mit
Claude im Repo arbeitet.

## Projekt in einem Satz

Mobile-first PWA zum Urban-Golf-Scoring, monorepo mit Vue 3 Frontend und
Fastify 5 Backend, vollständig in Docker containerisierbar, Offline-fähig.

## Tech-Stack auf einen Blick

- **Frontend**: Vue 3.4 + Vite 8 + TypeScript + Tailwind v4 + Pinia 3 + Vue-Router 5 + vue-i18n 11 + vite-plugin-pwa 1
- **Backend**: Fastify 5 + pg (nativer PostgreSQL-Client) + @fastify/compress
- **DB**: PostgreSQL 16 (Alpine) — Schema in [backend/db/init/schema.sql](backend/db/init/schema.sql)
- **Tests**: Vitest (Unit) + Playwright Smoke-Suite mit Mock-API. Backend-Contract-Tests geplant — siehe [.claude/plans/backend-contract-tests.md](.claude/plans/backend-contract-tests.md).
- **Infra**: Docker + Nginx (statische Auslieferung Frontend) + Traefik-ready, GitHub Actions CI/CD

## Workspaces

Dies ist ein **npm-Workspace-Monorepo** (siehe [package.json](package.json)):
- `frontend/` → `urban-golf-frontend`
- `backend/`  → `urban-golf-backend`

Root-Scripts proxien in die Workspaces. Beispiel:
```bash
npm run dev            # startet beide parallel
npm run test:all       # lint + type-check + unit + smoke-e2e
```

## Wichtige Befehle

| Befehl | Zweck |
| --- | --- |
| `npm install` | beide Workspaces installieren |
| `npm run dev` | Frontend + Backend parallel starten |
| `npm run test:all` | komplette Test-Pipeline ohne Backend (~15 s) |
| `npm run test:e2e:smoke --workspace=frontend` | Smoke-E2E (Playwright mit Mock-API, kein Backend) |
| `npm run docker:dev` | kompletter Stack via Docker Compose |

## Code-Konventionen

- **TypeScript durchgängig** im Frontend. Keine `any`. Composables als `.ts`, Vue-SFC mit `<script setup lang="ts">`.
- **i18n**: alle User-facing Strings via `$t('Key')`. Master-Locale ist `de.json`. Neue Keys in allen vier Locales (de, en, fr, nl) ergänzen.
- **Design-Tokens** statt Hardcoded-Farben. Siehe [frontend/src/assets/tokens.css](frontend/src/assets/tokens.css). Für Details siehe den Skill `.claude/skills/ui-tokens`.
- **Kein Glass-Morphism** mehr (wurde durch Elevation ersetzt). Historische Klassen wie `glass-card`, `button-primary`, `input-field` existieren NICHT mehr — verwende die neuen Primitive in [frontend/src/components/ui/](frontend/src/components/ui/).
- **ESLint + vue-tsc** müssen clean sein vor Commit. `npm run lint:fix` löst die meisten Style-Issues.
- **Kommentare**: nur wo das *Warum* nicht offensichtlich ist. Keine What-Kommentare.

## Skills

Im `.claude/skills/` Verzeichnis liegen projektspezifische Guides, die Claude Code
beim Arbeiten nutzt:

- [ui-tokens](.claude/skills/ui-tokens/SKILL.md) — Design-Token-Bibel. Vor jeder UI-Änderung konsultieren.
- [redesign-component](.claude/skills/redesign-component/SKILL.md) — Workflow zum Neuschreiben einer einzelnen Komponente.

## Repo-Navigation (häufig gebrauchte Pfade)

```
frontend/src/
  App.vue                                  Root (mountet Background, Toast, PWA-Dialoge)
  main.ts                                  Vue + i18n + Pinia + PWA Service Worker
  router/index.ts                          Alle Routen + scrollBehavior
  layouts/DefaultLayout.vue                TopBar + Main + BottomNav (ausblendbar)
  pages/
    home/HomePage.vue                      Hero mit animiertem Gradient, Recent-Games-Strip
    games/GamesPage.vue                    Container für Liste, Detail, Hole-View
    games/GamesNewPage.vue                 Neues Spiel / Bearbeiten
    feedback/FeedbackPage.vue
    about/AboutPage.vue                    Sub-Router für AboutHome, Roadmap, ChangeLog
  components/
    layout/                                TopBar, BottomNav, SettingsSheet
    ui/                                    AppButton, AppCard, AppFab, AppBottomSheet,
                                           SegmentedControl, PlayerAvatar, ProgressRing, …
    games/                                 GamesList, Scorecard-Views (Ranking/Horiz/Vert), HoleView
    about/                                 AboutHome, Roadmap (Timeline), ChangeLog
    pwa/                                   PWAInstallBanner, PWAUpdateDialog
  composables/                             useGamesDetailData, useSortedPlayers, useOfflineSync,
                                           useThemeMode, useNetworkStatus, usePWAUpdate, …
  stores/syncQueue.ts                      Pinia-Store für Offline-Queue (dedup, persist)
  services/api.ts                          Axios-Wrapper + Retry
  locales/{de,en,fr,nl}.json               i18n-Strings
  assets/tokens.css                        Design-Tokens (Tailwind @theme)
  assets/global.css                        Base + Komponenten-Primitive + Animationen
```

## Arbeitsweise mit Claude Code

**Gut:**
- Vor UI-Änderungen: Tokens verwenden, Skills konsultieren
- Bei Refactors: `npm run test:all` laufen lassen bevor fertig gemeldet wird
- Bei Layouts: Mobile-first, Pixel-5-Viewport (393×851) als Referenz
- Breaking-Changes in der DB oder API: Schema-Migration + Notiz im CHANGELOG

**Nicht:**
- Alte CSS-Klassen (`.glass-card`, `.button-primary`, `.input-field`, `.maintitle`) re-introducieren
- Hardcoded Farben, px-Spacing, magic numbers — immer Tokens
- Auto-Commits ohne explizite Anfrage
- README/Docs ohne User-Auftrag erzeugen (Ausnahme: wenn hier explizit gefordert)

## Tests sind Pflicht-Gates

Branch-Protection (via CI) erwartet, dass diese Jobs grün sind:
- `static-checks` (Lint + Type-Check)
- `unit-frontend` + `unit-backend`
- `e2e-smoke` (Playwright mit Mock-API)
- `ci-green` (Meta-Gate)

Siehe [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Wenn du hier fertig bist

1. Commit-Message im Imperativ, kurz ("Fix", "Add", "Update").
2. `npm run test:all` lokal grün.
3. PR gegen `main`, Reviewer-Notiz wenn etwas Manual-Check braucht (z.B. neue Migrations).

## Agent skills

### Issue tracker

Issues live in `st-albani/sc.urban-golf.ch` on GitHub via the `gh` CLI. See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

Canonical defaults — all five labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) exist on the repo. See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root cover both `frontend/` and `backend/`. See [docs/agents/domain.md](docs/agents/domain.md).
