-- Loch-Obergrenze von 18 auf 200 anheben.
--
-- Die 18 stammt aus der Schema-Härtung (002_harden-scores-schema) und war die
-- Zahl aus dem klassischen Golf — nie eine fachliche Anforderung. Urban-Golf-
-- Runden haben typischerweise 9, 12 oder auch deutlich mehr Bahnen, und das
-- Limit hat solche Runden schlicht abgeschnitten (POST /scores gab 400).
--
-- 200 bleibt als reine Sanity-Grenze bestehen: sie fängt kaputte Loch-Nummern
-- aus veralteten Links oder korrupten Navigationen ab, ohne reale Runden zu
-- begrenzen. Die Grenze wird im Frontend und Backend aus dem gemeinsamen
-- Contract gelesen (packages/contract → VALIDATION.HOLE_MAX) — beide Werte
-- müssen zusammen geändert werden.
--
-- Rein erweiternd: keine bestehende Zeile verletzt die neue Bedingung.
-- Idempotent: erneutes Ausführen ist folgenlos.
ALTER TABLE public.scores
  DROP CONSTRAINT IF EXISTS chk_hole;

ALTER TABLE public.scores
  ADD CONSTRAINT chk_hole CHECK (hole >= 1 AND hole <= 200);
