-- Spiel-Sichtbarkeit: eingeloggte Ersteller können ein Spiel privat halten.
-- 'public' (Default) = wie bisher öffentlich gelistet & durchsuchbar.
-- 'private' = aus der öffentlichen Liste/Suche ausgeblendet, aber weiterhin
-- für Ersteller und zugeordnete Mitspieler in „Meine Spiele" sichtbar.
--
-- Bestehende Zeilen erhalten über den Default 'public' — keine Runde wird
-- rückwirkend versteckt. Als text + CHECK (statt boolean) modelliert, damit
-- spätere Stufen (z. B. 'unlisted') ohne erneute Typänderung möglich bleiben.
-- Idempotent: erneutes Ausführen ist folgenlos.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_visibility_check;

ALTER TABLE public.games
  ADD CONSTRAINT games_visibility_check CHECK (visibility IN ('public', 'private'));
