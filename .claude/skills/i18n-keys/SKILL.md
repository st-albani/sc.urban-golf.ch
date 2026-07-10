---
name: i18n-keys
description: Konsistenter Workflow für neue i18n-Keys, Pluralisierung und Hardcoded-String-Audits in allen 4 Locales (de, en, fr, nl)
---

# i18n-Keys Workflow

Die App unterstützt 4 Sprachen — `de` (Master), `en`, `fr`, `nl`. Hardcoded
Strings in Komponenten leaken für non-DE-User als deutsche Wörter. Dieser
Skill sichert Konsistenz.

## Locale-Dateien

```
frontend/src/locales/
  de.json      ← Master: zuerst aktualisieren
  en.json
  fr.json
  nl.json
```

Ladung: [frontend/src/main.ts](../../../frontend/src/main.ts) via `createI18n({ legacy: false, ... })`.

## Neue Keys hinzufügen

**Reihenfolge** (wichtig, sonst verpasst man Locales):

1. `de.json` — Master, formuliere den Schweizer-Deutschen Wortlaut
2. `en.json` — Englische Übersetzung (ist häufig der zweite Prüfpunkt)
3. `fr.json` — Französisch
4. `nl.json` — Niederländisch

**Struktur**: Keys verschachtelt nach Feature:
```json
{
  "Feedback": {
    "Errors": {
      "RatingRequired": "Bitte 1 bis 5 Sterne vergeben."
    }
  }
}
```

Nicht: flache Keys wie `"Feedback.Errors.RatingRequired"`.

## Pluralisierung

vue-i18n v11 mit `legacy: false` hat **kein** `$tc`. Statt dessen: zwei getrennte
Keys und im Code den passenden wählen:

```json
// de.json
"HoleOne": "{n} Loch",
"HoleMany": "{n} Löcher"
```

```ts
function holeCountLabel(n: number): string {
  return n === 1 ? t('General.HoleOne', { n }) : t('General.HoleMany', { n })
}
```

## Verwendung in Komponenten

**Template**:
```vue
<template>
  <h1>{{ $t('Feedback.Title') }}</h1>
  <p>{{ $t('Games.HoleView.ScoreFor', { player: player.name }) }}</p>
</template>
```

**Script (Composition API)**:
```ts
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

function showError() {
  toast.error(t('Feedback.Errors.SendFailed'))
}
```

**Nicht in `aria-label` hardcoden**:
```vue
<!-- schlecht -->
<button aria-label="Spieler entfernen">...</button>

<!-- gut -->
<button :aria-label="$t('Games.NewGame.RemovePlayer')">...</button>
```

## Hardcoded-Strings aufspüren

Bevor eine Komponente als "fertig" gilt, Suche nach:

```bash
# Typische deutsche Wörter in Template-Strings
grep -rn "aria-label=\"[A-ZÄÖÜ]" frontend/src/components frontend/src/pages | grep -v "\\$t"
grep -rn ">\s*[A-ZÄÖÜ][a-zäöü]\+\s*<" frontend/src/components frontend/src/pages | grep -v "\\$t" | grep -v "\\.test\\."

# Error-Messages / Validation-Texte im Script
grep -rn "showError\|showSuccess\|toast.error\|alert(" frontend/src | grep -v "\\$t\\|t(" | head -20
```

Finds ggf. Strings wie `showError('Bitte ...')` die auf `$t(...)` umgestellt werden müssen.

Auch **statische `aria-label` / `placeholder` / `title`** prüfen — sie leaken für Screenreader-User in der falschen Sprache:

```bash
grep -rnE "[^:](aria-label|placeholder|title)=\"[A-Za-zÄÖÜ]" frontend/src/components frontend/src/pages --include=*.vue
```

Treffer auf gebundene i18n-Ausdrücke umstellen (`:aria-label="$t('…')"`). Ausnahme: reine Marken-/Eigennamen (z. B. `ScoreCard`) bleiben unübersetzt.

### Kein hartes Hardcoded-Gate (bewusste Entscheidung)

Für hartkodierte Strings gibt es **absichtlich kein** durchsetzendes CI-Gate: die statische Erkennung kann user-facing nicht zuverlässig von technischen Strings (Log-Ausgaben, CSS-Klassen, Test-IDs) trennen — ein hartes Gate würde an False Positives ersticken. Der Audit oben ist der wiederholbare Weg; er wird vor „fertig" ausgeführt, nicht von der Pipeline erzwungen.

## Placeholder-Konvention

User-facing Placeholder sollten Beispiele sein, keine Label-Duplikate:

```
// schlecht: redundant mit Label
Label: "Spielname"
Placeholder: "Spielname"

// gut: konkretes Beispiel
Label: "Spielname"  
Placeholder: "z.B. Sonntag im Eulachpark"
```

## Validation bei Adds

Key-Parität **und** Platzhalter-/Plural-Konsistenz sind als automatisches Gate
durchgesetzt (Vitest, läuft im `unit-frontend`-Job):

```bash
npm run test --workspace=frontend   # schlägt fehl bei fehlenden/überzähligen Keys
                                     # und bei abweichenden {platzhaltern}/Pluralen
```

Die Tests liegen in `frontend/src/locales/__tests__/` (`locale-parity.test.ts`,
`locale-placeholders.test.ts`) und vergleichen alle Locales gegen `de.json`
(Master). Fehlermeldungen listen pro Sprache konkret die fehlenden bzw.
überzähligen Keys und die divergierenden Platzhalter auf.

Schneller lokaler Ad-hoc-Check ohne Testlauf:

```bash
node -e "
const locales = ['de', 'en', 'fr', 'nl'].map(l => require('./frontend/src/locales/' + l + '.json'))
function keys(obj, prefix = '') {
  const out = []
  for (const k in obj) {
    const p = prefix ? prefix + '.' + k : k
    if (typeof obj[k] === 'object' && obj[k] !== null) out.push(...keys(obj[k], p))
    else out.push(p)
  }
  return out
}
const [de, en, fr, nl] = locales.map(keys)
const deSet = new Set(de)
console.log('en diff:', en.filter(k => !deSet.has(k)).concat(de.filter(k => !new Set(en).has(k))))
"
```

## Typische Fehler

- **`$tc` verwendet** → nicht verfügbar in v11 non-legacy. Zwei-Keys-Pattern nutzen.
- **Named parameter + count gemischt** → ebenfalls tricky. Explizit in TS/JS entscheiden.
- **Nur de + en updated** → FR/NL-User sehen den nicht übersetzten Default (meist den Key selbst).
- **Key existiert in allen Locales, aber Wortlaut falsch** → alle 4 durchlesen.

## Bei Unsicherheit

Wenn ich nicht weiß, wie etwas auf FR/NL heißt: pragmatisch die DE-Version als
Platzhalter mit einem TODO-Kommentar im Code melden, nicht falsch raten.
