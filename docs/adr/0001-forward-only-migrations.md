# ADR-0001: Migrations sind vorwärts-only

- **Status:** Angenommen
- **Datum:** 2026-08-10

## Kontext

Das Repo führte ein `db:migrate:down` bzw. `migrate:down` als npm-Skript. Es hat
nie funktioniert: keine der elf SQL-Migrations in `backend/db/migrations/`
definiert einen Down-Abschnitt, also bricht node-pg-migrate sofort ab mit

```
Error: User has disabled down migration on file: 011_raise-hole-limit
```

Das Verhalten ist unabhängig von der Version — gegen eine echte Postgres-16-Instanz
sowohl mit node-pg-migrate 8.0.4 als auch 9.0.0 reproduziert. Das Skript war also
kein kaputtes Feature, sondern eines, das es nie gab.

Damit stand die Frage: Down-Abschnitte nachrüsten oder Vorwärts-only festschreiben?

## Entscheidung

**Migrations laufen ausschliesslich vorwärts.** Die toten `migrate:down`-Skripte
sind entfernt, statt sie mit Rollback-Logik zu füllen.

## Begründung

Der Ausschlag kam nicht aus Bequemlichkeit, sondern daher, dass mehrere der
bestehenden Migrations technisch nicht umkehrbar sind:

- **`009_reset-name-based-claims`** führt ein `DELETE FROM public.account_players`
  aus — ein bewusster Cutover auf das kanonische Identitätsmodell. Gelöschte
  Zuordnungen kann kein Down-Abschnitt wiederherstellen; die Information
  existiert nach der Migration schlicht nicht mehr.

- **`011_raise-hole-limit`** hebt `chk_hole` von 18 auf 200. Ein Down würde die
  Bedingung wieder auf `<= 18` setzen und genau dann scheitern, wenn Runden mit
  mehr als 18 Bahnen existieren — also genau dann, wenn die Migration ihren
  Zweck erfüllt hat. Ein Rollback, der nur solange klappt, wie er nutzlos ist.

- **`001_initial-schema`** liesse sich nur durch das Verwerfen des kompletten
  Schemas umkehren. Das ist in Produktion keine Operation, die jemand ausführen
  möchte.

Ein Down-Pfad, der für ein Drittel der Migrations nur pro forma existiert, ist
schlechter als gar keiner: er suggeriert eine Sicherheit, die im Ernstfall nicht
trägt.

## Konsequenzen

- Ein fehlerhafter Schema-Stand wird durch eine **neue, korrigierende Migration**
  behoben, nicht durch ein Zurückrollen. Die Historie bleibt dadurch linear und
  entspricht dem, was in Produktion tatsächlich passiert ist.
- Neue Migrations müssen entsprechend sorgfältig geprüft werden, bevor sie auf
  `main` landen — der Deploy fährt sie im Entrypoint des Backend-Containers
  automatisch hoch.
- Für lokales Zurücksetzen gibt es weiterhin `npm run db:reset`: es verwirft das
  Docker-Volume und baut die Datenbank neu auf. Das ist in Dev der schnellere und
  ehrlichere Weg als ein Migration-Rollback.
- `backend/scripts/baseline-migrations.js` bleibt unverändert. Es stampt die
  Baseline 001/002 für Altbestände, in denen das Schema über
  `backend/db/init/schema.sql` geladen wurde, und ist von dieser Entscheidung
  nicht berührt.
