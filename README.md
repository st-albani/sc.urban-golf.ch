# Urban Golf ScoreCard

Eine schnelle, mobile-first **PWA** zum Erfassen von Urban-Golf-Scores mit Live-Ranking,
Offline-Sync und i18n. Open-Source, selfhosted via Docker, entwickelt vom
Urban-Golf-Verein Winterthur.

<p align="center">
  <sub>Vue 3 · TypeScript · Fastify 5 · PostgreSQL 16 · Docker · PWA · Playwright</sub>
</p>

## ✨ Features

- **Live-Scorecard** mit Podium und Heatmap-Vergleich zum Loch-Ø
- **Ranking-First** — Leaderboard ist die Default-Ansicht
- **Offline-fähig** — Scores werden lokal gequeued und beim nächsten Online-Gang synchronisiert
- **PWA** mit iOS/Android Install-Banner, Update-Prompt, Service Worker
- **Mobile-First Design** (Greenway Design System) mit animiertem Hero, Bottom-Nav und Bottom-Sheet-Keypad für Score-Eingabe
- **Mehrsprachig** — 🇩🇪 DE · 🇬🇧 EN · 🇫🇷 FR · 🇳🇱 NL
- **Dark/Light/System** via Settings-Sheet

## 🧱 Repo-Struktur

Dies ist ein **npm-Monorepo** mit zwei Workspaces und einer gemeinsamen Lockfile:

```
sc.urban-golf.ch/
├── frontend/              Vue 3 + Vite + Tailwind v4 PWA
├── backend/               Fastify 5 + PostgreSQL
├── .github/workflows/     CI/CD (Lint, Tests, Build, Deploy)
├── .claude/               Claude Code Konfig + Skills (Design-Tokens, Redesign-Workflow)
├── docker-compose*.yml    Dev + Prod Compose-Stacks
├── README.md
├── CONTRIBUTING.md        Wie man mitmacht
├── ARCHITECTURE.md        Technische Architektur
├── DEPLOYMENT.md          Deployment + Docker + Proxy
└── CLAUDE.md              Guide für Claude Code / LLM-Agents
```

## 🚀 Quick Start

### Mit Docker (empfohlen, alles in einem)

```bash
git clone https://github.com/st-albani/sc.urban-golf.ch.git
cd sc.urban-golf.ch
docker compose -f docker-compose.dev.yml up -d
```

- Frontend → <http://localhost:8080>
- Backend API → <http://localhost:3000/api>
- pgAdmin → <http://localhost:5050> (admin@urbangolf.local / admin)

### Nativ (ohne Docker, Node 20+)

```bash
npm install                      # beide Workspaces
# Backend benötigt Postgres — einfachste Option: nur Postgres via Docker starten
docker compose -f docker-compose.dev.yml up -d postgres
npm run dev                      # startet Frontend (5173) + Backend (3000) parallel
```

## 🧪 Tests

Alles auf einen Blick:

```bash
npm run test:all          # Lint + Type-Check + Unit + Smoke-E2E (≈15 s)
```

Einzeln:

| Command | Zweck | Backend nötig |
| --- | --- | --- |
| `npm run lint` | ESLint über beide Workspaces | nein |
| `npm run type-check` | vue-tsc für Frontend | nein |
| `npm test` | Vitest Unit-Tests (beide Workspaces) | nein |
| `npm run test:e2e:smoke --workspace=frontend` | Playwright mit Mock-API | nein |
| `npm run test:visual --workspace=frontend` | Screenshot-Audit (Light+Dark) | nein |

Details: [frontend/TESTING.md](frontend/TESTING.md). Backend-Contract-Tests
sind in Planung — siehe [.claude/plans/backend-contract-tests.md](.claude/plans/backend-contract-tests.md).

## 🎨 Design System — "Greenway"

- **Tokens** (Farben, Typo, Spacing, Motion): [frontend/src/assets/tokens.css](frontend/src/assets/tokens.css)
- **Base-Styles** + Komponenten-Primitive: [frontend/src/assets/global.css](frontend/src/assets/global.css)
- **UI-Komponenten**: `AppButton`, `AppCard`, `AppFab`, `AppBottomSheet`, `SegmentedControl`, `PlayerAvatar`, `ProgressRing` in [frontend/src/components/ui/](frontend/src/components/ui/)
- **Claude-Skill** mit Regeln zum Redesign: [.claude/skills/ui-tokens/SKILL.md](.claude/skills/ui-tokens/SKILL.md)

## 📜 Weiterführende Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — Datenfluss, Offline-Sync, PWA, Routing
- [CONTRIBUTING.md](CONTRIBUTING.md) — Branching, Commits, PRs, Konventionen
- [DEPLOYMENT.md](DEPLOYMENT.md) — Docker-Compose, Reverse-Proxy, DB-Dumps
- [frontend/README.md](frontend/README.md) — Frontend-Dev-Guide
- [frontend/TESTING.md](frontend/TESTING.md) — Test-Pipeline
- [backend/README.md](backend/README.md) — Backend-Dev-Guide
- [CLAUDE.md](CLAUDE.md) — Wenn du mit Claude Code arbeitest

## 🗺️ Roadmap

Transparent in der App sichtbar unter `/about/roadmap`. Stand: User-Mgmt, Kursverwaltung,
Spielerstatistiken und Club-Management sind als Nächstes dran.

## 🤝 Contributing

PRs sehr willkommen — siehe [CONTRIBUTING.md](CONTRIBUTING.md). Vor dem Push:
`npm run test:all` sollte grün sein.

## 📄 License

MIT — frei nutzen, modifizieren und teilen mit Urheberhinweis.

## 📬 Contact

Open an issue on [GitHub](https://github.com/st-albani/sc.urban-golf.ch/issues) oder via
`/feedback` direkt aus der App.
