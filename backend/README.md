# Backend — Urban Golf ScoreCard

Die Fastify-5-API der ScoreCard-App. Für Architektur siehe
[../ARCHITECTURE.md](../ARCHITECTURE.md), für Deployment
[../DEPLOYMENT.md](../DEPLOYMENT.md).

## Quick Start

```bash
cd backend
npm install
docker compose -f ../docker-compose.dev.yml up -d postgres    # nur Postgres
cp .env.example .env                                          # falls vorhanden
npm run migrate:up                                            # DB-Schema
npm run dev                                                   # http://localhost:3000
```

## Tech Stack

| Bereich | Version / Library |
| --- | --- |
| Runtime | Node.js 24 LTS (ESM) |
| Framework | Fastify 5 |
| DB | PostgreSQL 16 via `pg` (nativer Client, kein ORM) |
| Migrations | node-pg-migrate 9 (SQL-Files, vorwärts-only) |
| Security | @fastify/helmet, @fastify/cors, @fastify/rate-limit |
| Compression | @fastify/compress 9 (brotli + gzip, ab 1 KB — siehe unten) |
| Mail | nodemailer (Brevo/SMTP für Feedback) |
| Tests | Vitest 4 |
| Lint | ESLint 10 |

### Zur Kompression

`@fastify/compress` ist in `app.js` global registriert und komprimiert
API-Antworten ab 1 KB mit brotli oder gzip, je nach `Accept-Encoding`. Der
Schwellwert entspricht dem `gzip_min_length` in `frontend/nginx.conf`, Brotli
läuft auf Qualität 4 — für dynamische Antworten der sinnvolle Kompromiss.

Kompression gehört ins Backend, weil sie sonst nirgends passiert: In Produktion
routet Traefik `/api` direkt aufs Backend, nginx sieht die API-Antworten also
nie. Im Compose-Pfad liefe es zwar durch nginx, dessen `gzip` greift aber ohne
`gzip_proxied` nicht für Upstream-Antworten.

> **Wichtig für neue Routen:** Jeder async-Handler muss sein Ergebnis
> zurückgeben — `return reply.send(x)` oder `return wert`.
>
> ```js
> async (req, reply) => { return reply.send(data) }  // korrekt
> async (req, reply) => { reply.send(data) }         // liefert einen leeren Body
> ```
>
> Gibt der Handler implizit `undefined` zurück, ist das für Fastify die
> Aussage „die Antwort ist `undefined`". Es folgt ein zweiter `onSend`-Zyklus,
> dessen leerer Payload die bereits komprimierte Antwort überschreibt —
> Resultat ist `content-length: 0` und ein leerer Body, ohne Fehlermeldung.
>
> Das ist kein Bug im Plugin, sondern Fastifys Promise-Semantik seit v4
> ([fastify-compress#237](https://github.com/fastify/fastify-compress/issues/237)).
> Ohne aktive Kompression fällt es nur nicht auf, weil Fastifys
> „bereits gesendet"-Guard den zweiten Zyklus abfängt.

Gemessen an echten Antworten (Postgres 16, 60 Runden à 6 Spieler × 18 Löcher):

| Endpunkt | identity | gzip | brotli |
| --- | --- | --- | --- |
| `GET /api/scores?game_id=…` | 13.663 B | 934 B (−93 %) | 862 B (−94 %) |
| `GET /api/players` | 10.939 B | 1.043 B (−90 %) | 638 B (−94 %) |
| `GET /api/games/summary` | 6.579 B | 737 B (−89 %) | 639 B (−90 %) |

Statische Frontend-Assets laufen weiterhin einen eigenen Weg: die komprimiert
`vite-plugin-compression2` beim Build vor, ausgeliefert via `gzip_static` in
`frontend/nginx.conf`.

## Projektstruktur

```
backend/
├── app.js                       Fastify-Bootstrap, Plugin-Registrierung, Server-Start
├── routes/
│   ├── games.js                 /api/games, /api/games/:id, /api/games/summary, …
│   ├── players.js               /api/players
│   ├── scores.js                /api/scores
│   └── feedback.js              /api/feedback
├── db/
│   ├── index.js                 pg-Pool-Singleton
│   ├── init/schema.sql          Schema für initiale Docker-DB
│   └── migrations/              node-pg-migrate SQL-Files
├── utils/                       Helpers
├── scripts/                     Baseline-Migration, Utility-Scripts
├── test/                        Vitest-Tests
├── Dockerfile                   Multi-Stage Build
├── eslint.config.js
└── package.json
```

## Environment

`.env` (Root oder `backend/.env`) — Key-Wert-Paare:

```
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/urban_golf
DATABASE_SSL=false
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
NODE_ENV=development

# Feedback-Mail (Brevo/SMTP)
BREVO_SMTP_USER=your-login@example.com
BREVO_SMTP_PASS=***********
ADMIN_EMAIL=admin@urban-golf.ch
```

`DATABASE_URL` ist die einzige Pflicht-Variable; alle anderen haben Defaults.

## NPM Scripts

| Script | Zweck |
| --- | --- |
| `npm run dev` | Server starten (node app.js) |
| `npm start` | Produktionsstart |
| `npm test` | Vitest Unit-Tests |
| `npm run test:watch` | Vitest Watch-Mode |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run migrate:up` | Migrations anwenden (SQL-Files in `db/migrations/`) |
| `npm run migrate:create` | Neues Migration-Skelett erzeugen |
| `npm run migrate:baseline` | Bestehende DB als "migrated" markieren (einmalig nach Init-Schema) |

### Typischer Migration-Flow

```bash
# 1) Neue Migration anlegen
npm run migrate:create -- add_course_table
# → erzeugt db/migrations/<ts>_add_course_table.sql

# 2) SQL in die Datei schreiben (up-Section)

# 3) Anwenden
npm run migrate:up
```

Migrations laufen **vorwärts-only** — es gibt bewusst kein `migrate:down`, siehe
[ADR-0001](../docs/adr/0001-forward-only-migrations.md). Ein fehlerhafter
Schema-Stand wird durch eine neue, korrigierende Migration behoben. Lokal setzt
`npm run db:reset` (Repo-Root) die Datenbank per Volume-Neuaufbau zurück.

## API-Routen (Kurzüberblick)

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/api/games/summary?page=1&per_page=10&search=…` | paginierte Liste mit Meta (Spieler, Löcher, Stats) |
| GET | `/api/games/:id` | Spiel-Basisdaten |
| GET | `/api/games/:id/players` | Spieler eines Spiels |
| POST | `/api/games` | Spiel anlegen/updaten |
| GET | `/api/scores?game_id=…` | Scores eines Spiels |
| POST | `/api/scores` | Score anlegen/überschreiben (upsert) |
| POST | `/api/players` | Spieler anlegen/updaten |
| POST | `/api/feedback` | Feedback abgeben (triggert Mail) |

Vollständige Schnittstellen-Signatur: [routes/](routes/).

## Docker

Produktions-Image via [Dockerfile](Dockerfile). Wird automatisch in CI/CD gebaut —
siehe [.github/workflows/ci.yml](../.github/workflows/ci.yml).

Lokal bauen:
```bash
docker build -f Dockerfile -t urbangolf-backend:dev ..
```

## Testing

Unit-Tests mit Vitest in `test/`. Für E2E-Tests gegen ein laufendes Backend
siehe [../frontend/TESTING.md](../frontend/TESTING.md#6-integration-e2e-npm-run-teste2e).

## Troubleshooting

- **DB-Connection schlägt fehl**: `DATABASE_URL` prüfen, Postgres erreichbar? `psql $DATABASE_URL` testet die Verbindung.
- **Migrations hängen**: `npm run migrate:baseline` einmalig gegen bereits initialisierte DB; dann `migrate:up`.
- **CORS-Fehler im Frontend**: `ALLOWED_ORIGINS` muss den Frontend-Origin (inkl. Protokoll + Port) enthalten.
- **Port 3000 belegt**: `PORT=3010 npm run dev`.
