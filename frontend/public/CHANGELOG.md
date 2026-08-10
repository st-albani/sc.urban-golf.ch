# Changelog

---

## [Unreleased]
### 🪲 Bugfixes
- Scores gehen bei wackliger Verbindung nicht mehr verloren — bisher konnten
  einzelne Löcher aus einer Runde verschwinden, wenn der Browser sich für online
  hielt, der Request aber scheiterte (WLAN ohne Internet, Captive Portal,
  schwaches Mobilnetz). Jede Eingabe landet jetzt zuerst in der Sync-Queue.
- Offline erfasste Scores werden auch dann übertragen, wenn die App zwischendurch
  geschlossen wurde (Flush beim Start statt nur beim Online-Wechsel)
- Der letzte Score geht nicht mehr verloren, wenn direkt danach das Handy
  gesperrt wird

### ✨ Verbesserungen
- Runden sind nicht mehr auf 18 Löcher begrenzt (neu bis 200) — Urban-Golf-Runden
  folgen nicht dem klassischen 18-Loch-Schema
- Rate-Limit für Score-Eingaben angehoben, damit grössere Gruppen im selben
  Netz sich nicht gegenseitig ausbremsen

> **Migration:** `011_raise-hole-limit.sql` hebt den `chk_hole`-Constraint an.
> Wird beim Container-Start automatisch angewendet.

---

## [3.0.0] – 2026-04-16
### 🎨 Greenway Design-System
- Komplett neu designtes UI: mobile-first, Ranking-First Scorecard
- Neues Token-System (OKLCH-Farben, Typo-Scale, Elevation) via Tailwind v4 `@theme`
- Animierter Hero-Titel und Aurora-Hintergrund auf der Startseite
- Bottom-Nav mit Floating-Action-Button für "Neues Spiel"
- Immersive Score-Eingabe mit Keypad-Sheet und Swipe-Gesten
- Podium-Ansicht mit Gold/Silber/Bronze in der Rangliste
- Dark-/Light-/System-Mode via Settings-Sheet
- Scroll-to-top bei Route-Wechseln

### ✅ Qualitätssicherung
- Smoke-E2E-Suite mit Playwright + Mock-API (kein Backend nötig)
- Visual-Audit-Script für automatisierte Screenshot-Reviews
- Erweiterte Unit-Test-Coverage (scoreHeatmap, format, usePlayerColors)
- Aktualisierte GitHub-Actions-Pipeline mit Smoke-Gate

### 🪲 Bugfixes
- Dark-Mode wird korrekt angewendet (Specificity-Fix in tokens.css)
- Rangliste zeigt den tatsächlichen Leader by Total (nicht nach aktueller Sortierung)
- Action-Bar in der Hole-View verdeckt nicht mehr den letzten Spieler

---

## [2.0.1] – 2025-08-15
### 🎉 Milestones
- The project is now open source and we're happy for your contribution 🎉
-- https://github.com/st-albani/sc.urban-golf.ch

### ✨ New features
- Infinite scolling in Games-List
- About, Roadmap and Changelog implemented
- Dependencies updated
- UX and style improvements

### 🪲 Bugfixes
- Scores could not be entered, database schema had to be adjusted

---

## [2.0.0] – 2025-07-25
### 🎉 New features
- Initial release of the new App
- New TechStack with node.js, Vue 3, Tailwind, Fastify, Postgres-Database
- Automatic CI/CD pipelines and proper TEST/PROD environments
- Mobile optimized and PWA functionality

### 🪲 Bugfixes
- none