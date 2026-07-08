# Contributing

Willkommen! Pull-Requests sehr erwünscht. Dieses Dokument erklärt den
Entwicklungs-Flow.

## Setup

```bash
git clone https://github.com/st-albani/sc.urban-golf.ch.git
cd sc.urban-golf.ch
npm install                                # installiert beide Workspaces
docker compose -f docker-compose.dev.yml up -d postgres
npm run dev                                # Frontend + Backend parallel
```

## Branches

- Feature: `feature/<kurz-beschreibend>`, z.B. `feature/course-management`
- Bugfix: `fix/<kurz-beschreibend>`, z.B. `fix/hole-navigation-swipe`
- Chore/Docs: `chore/<kurz>`, `docs/<kurz>`

Branch-Basis ist immer `main`.

## Pre-Push-Checkliste

Vor jedem Push:

```bash
npm run test:all
```

Das läuft in ~15s und umfasst:
1. Lint (ESLint + eslint-plugin-vue + typescript-eslint)
2. Type-Check (`vue-tsc --noEmit`)
3. Unit-Tests (Vitest, Frontend + Backend)
4. Smoke-E2E (Playwright mit Mock-API, Mobile + Desktop)

Für API-Verifikation gegen ein echtes Backend: siehe den Contract-Test-Plan
[`.claude/plans/backend-contract-tests.md`](.claude/plans/backend-contract-tests.md).
Die frühere Playwright-Integration-Suite wurde entfernt, weil sie ans alte UI
gebunden war und durch die Smoke-Suite funktional abgelöst wurde.

## Commits

- Imperativ: "Add X", "Fix Y", "Update Z"
- Keine Emoji in Commit-Messages (die dürfen gerne in UI-Texten bleiben).
- Referenziere Issues mit `#NN` wo sinnvoll.
- Atomic Commits bevorzugt — ein Fix pro Commit, wenn möglich.

Beispiele:
```
Fix podium ranking to use total instead of current sort
Add bottom sheet keypad for score entry
Update tokens.css: increase contrast of score heatmap in dark mode
```

## Pull Requests

- **Titel**: kurzer Imperativ, wie die Commit-Message.
- **Beschreibung**: was ändert sich, warum, was wurde getestet. Bei UI-Änderungen:
  Screenshots/GIFs hinzufügen (gerne aus `frontend/e2e/screenshots/` nach `npm run test:visual`).
- **Reviewer**: mindestens eine Person vor dem Merge.
- **CI muss grün sein** — siehe [.github/workflows/ci.yml](.github/workflows/ci.yml)
  und den `ci-green`-Meta-Job.

## Code-Style

### TypeScript / Vue

- `<script setup lang="ts">` für alle neuen Komponenten.
- Props/Emits als TypeScript-Interface (`defineProps<...>()`, `defineEmits<...>()`).
- Kein `any`. Bei generischen Containern `unknown` mit Type-Narrowing bevorzugen.
- Composables in `.ts`-Files, keine Vue-Abhängigkeiten im Backend-Code.

### Styling

- **Immer Design-Tokens** — keine Hardcoded-Farben, keine magic-px.
- Tokens leben in [frontend/src/assets/tokens.css](frontend/src/assets/tokens.css).
- Base-/Utility-Klassen in [frontend/src/assets/global.css](frontend/src/assets/global.css).
- Komponenten-Primitive in [frontend/src/components/ui/](frontend/src/components/ui/) — bevorzugt
  diese verwenden statt neue Kleinteile.
- Mobile-first (Pixel 5 = 393×851 ist die Referenz-Viewport).

### Internationalization

- Alle User-Texte durch `$t('Key')`.
- Neue Keys in **allen vier** Locales ergänzen (de, en, fr, nl). `de` ist Master.
- Keine Texte in Deutsch hardcoden, außer in `de.json`.

### Kommentare

- Nur wo das *Warum* nicht offensichtlich ist.
- Keine Kommentare die nur wiederholen was der Code tut.
- Keine Hinweise auf "Added by X for bug #Y" — das gehört in die Commit-Message/PR.

### Accessibility

- Alle Tap-Targets ≥ 44 px.
- Icon-Buttons brauchen `aria-label`.
- `:focus-visible` Styles nie deaktivieren.
- `prefers-reduced-motion` respektieren.

## Was NICHT tun

- Keine alten CSS-Klassen wie `.glass-card`, `.button-primary`, `.input-field`,
  `.maintitle` re-introducieren — die wurden beim Redesign entfernt.
- Keine `console.log` in produktivem Code (ESLint warnt).
- Keine `@ts-ignore` ohne Begründung als Kommentar.
- Keine neuen NPM-Dependencies ohne Begründung im PR.
- Keine Commits mit `.env`, Secrets, API-Keys.

## Debugging-Tipps

- **Screenshots erstellen**: `npm run test:visual --workspace=frontend` → `frontend/e2e/screenshots/*.png`
- **Dev-Server auf anderem Port**: `npm run dev --workspace=frontend -- --port 5175`
- **Playwright-Debug**: `npm run test:e2e:smoke:headed --workspace=frontend`
- **DB-Reset**: `npm run db:reset` (löscht alle lokalen Dev-Daten!)

## Architektur-Entscheidungen

Bevor du größere Änderungen anfängst: [ARCHITECTURE.md](ARCHITECTURE.md) lesen.
Neue Architektur-Entscheidungen (z.B. "warum GraphQL?") gehören in einen ADR-Block
unter `docs/adr/` (bei Bedarf anzulegen) oder direkt in ARCHITECTURE.md.

## Fragen?

- GitHub-Issue öffnen
- Feedback via `/feedback` in der laufenden App
