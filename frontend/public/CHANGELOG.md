# Changelog

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